<?php

namespace App\Services\Exam;

use App\Enums\AttemptEventType;
use App\Enums\AttemptStatus;
use App\Enums\ParticipantStatus;
use App\Enums\SubmitReason;
use App\Exceptions\ExamException;
use App\Models\AttemptAnswer;
use App\Models\AttemptObservation;
use App\Models\AttemptSection;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamSection;
use App\Models\Participant;
use App\Models\Question;
use App\Models\QuestionGroup;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Seluruh aturan waktu dan alur ujian ditegakkan di sini. Client hanya menampilkan
 * hitung mundur berdasarkan tenggat yang dikirim server.
 *
 * Alur: pilar dikerjakan berurutan; setiap pilar punya tenggat sendiri; setelah pilar
 * selesai (manual atau waktu habis) ada jeda sebelum pilar berikutnya; pilar yang
 * selesai terkunci; pilar terakhir yang selesai berarti ujian terkirim.
 */
class ExamEngine
{
    /** Transaksi diulang otomatis bila MySQL melaporkan deadlock saat banyak peserta bersamaan. */
    private const TRANSACTION_ATTEMPTS = 5;

    public function __construct(private ScoringService $scoring) {}

    public function start(Participant $participant, Exam $exam): ExamAttempt
    {
        return DB::transaction(function () use ($participant, $exam) {
            // Kunci baris peserta (primary key), bukan rentang di exam_attempts: SELECT ... FOR UPDATE
            // pada baris yang belum ada memicu gap lock dan deadlock saat ratusan peserta mulai bersamaan.
            $participant = Participant::query()->lockForUpdate()->findOrFail($participant->id);

            $existing = ExamAttempt::query()
                ->where('exam_id', $exam->id)
                ->where('participant_id', $participant->id)
                ->first();

            if ($existing) {
                return $this->sync($existing);
            }

            if (! $exam->isOpen()) {
                throw ExamException::examClosed();
            }

            if (in_array($participant->status, [ParticipantStatus::Disqualified, ParticipantStatus::Eliminated], true)) {
                throw ExamException::participantBlocked();
            }

            $first = $exam->sections()->first();

            if (! $first) {
                throw ExamException::noSections();
            }

            $now = $this->now();

            $attempt = ExamAttempt::create([
                'exam_id' => $exam->id,
                'participant_id' => $participant->id,
                'status' => AttemptStatus::InProgress,
                'current_section_id' => $first->id,
                'started_at' => $now,
                'last_seen_at' => $now,
            ]);

            $this->openSection($attempt, $first, $now);

            $participant->forceFill(['status' => ParticipantStatus::InExam])->save();

            return $attempt->refresh();
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Menerapkan semua transisi yang jatuh tempo (tenggat pilar, akhir jeda) hingga saat ini.
     * Transisi berantai memakai waktu jatuh temponya, bukan waktu request, agar linimasa
     * tetap konsisten walau peserta sempat offline.
     */
    public function sync(ExamAttempt $attempt): ExamAttempt
    {
        if ($attempt->isSubmitted()) {
            return $attempt;
        }

        return DB::transaction(function () use ($attempt) {
            $attempt = ExamAttempt::query()->lockForUpdate()->findOrFail($attempt->id);
            $now = $this->now();
            $grace = (int) config('exam.grace_seconds');

            while (! $attempt->isSubmitted()) {
                if ($attempt->status === AttemptStatus::InProgress) {
                    $current = $this->currentAttemptSection($attempt);

                    if (! $current || $now->lt($current->deadline_at->copy()->addSeconds($grace))) {
                        break;
                    }

                    $this->finishSection($attempt, $current, $current->deadline_at->toImmutable(), SubmitReason::TimeUp);

                    continue;
                }

                if ($attempt->status === AttemptStatus::OnBreak) {
                    if ($now->lt($attempt->break_ends_at)) {
                        break;
                    }

                    $this->openSection($attempt, ExamSection::findOrFail($attempt->current_section_id), $attempt->break_ends_at->toImmutable());

                    continue;
                }

                break;
            }

            return $attempt->refresh();
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Peserta mengakhiri pilar yang sedang berjalan lebih awal.
     */
    public function finishCurrentSection(ExamAttempt $attempt): ExamAttempt
    {
        return $this->mutate($attempt, function (ExamAttempt $attempt) {
            $this->assertInProgress($attempt);

            $this->finishSection($attempt, $this->currentAttemptSection($attempt), $this->now(), SubmitReason::Manual);
        });
    }

    public function skipBreak(ExamAttempt $attempt): ExamAttempt
    {
        return $this->mutate($attempt, function (ExamAttempt $attempt) {
            if ($attempt->status !== AttemptStatus::OnBreak) {
                throw ExamException::notOnBreak();
            }

            $this->openSection($attempt, ExamSection::findOrFail($attempt->current_section_id), $this->now());
        });
    }

    public function startObservation(ExamAttempt $attempt, QuestionGroup $group): AttemptObservation
    {
        $observation = null;

        $this->mutate($attempt, function (ExamAttempt $attempt) use ($group, &$observation) {
            $this->assertInProgress($attempt);
            $this->assertGroupInCurrentSection($attempt, $group);

            if (! $group->requiresObservation()) {
                throw ExamException::invalidOption();
            }

            $now = $this->now();

            $existing = $attempt->observations()->where('question_group_id', $group->id)->first();

            if ($existing) {
                if ($existing->isActive($now)) {
                    $observation = $existing;

                    return;
                }

                throw ExamException::observationAlreadyUsed();
            }

            $otherActive = $attempt->observations()->where('ends_at', '>', $now)->exists();

            if ($otherActive) {
                throw ExamException::observationInProgress();
            }

            $deadline = $this->currentAttemptSection($attempt)->deadline_at->toImmutable();
            $endsAt = $now->addSeconds($group->observationSeconds());

            $observation = $attempt->observations()->create([
                'question_group_id' => $group->id,
                'started_at' => $now,
                'ends_at' => $endsAt->min($deadline),
            ]);
        });

        return $observation;
    }

    /**
     * Peserta menutup materi observasi sebelum waktunya habis.
     */
    public function finishObservation(ExamAttempt $attempt, QuestionGroup $group): void
    {
        $this->mutate($attempt, function (ExamAttempt $attempt) use ($group) {
            $now = $this->now();

            $attempt->observations()
                ->where('question_group_id', $group->id)
                ->where('ends_at', '>', $now)
                ->update(['ends_at' => $now]);
        });
    }

    public function answer(ExamAttempt $attempt, Question $question, ?int $optionId): AttemptAnswer
    {
        $answer = null;

        $this->mutate($attempt, function (ExamAttempt $attempt) use ($question, $optionId, &$answer) {
            $this->assertInProgress($attempt);

            if (! $question->is_active) {
                throw ExamException::sectionLocked();
            }

            $group = $question->group;
            $this->assertGroupInCurrentSection($attempt, $group);

            if ($group->requiresObservation()) {
                $observation = $attempt->observations()->where('question_group_id', $group->id)->first();

                if (! $observation || $observation->isActive($this->now())) {
                    throw ExamException::observationRequired();
                }
            }

            if ($optionId !== null && ! $question->options()->whereKey($optionId)->exists()) {
                throw ExamException::invalidOption();
            }

            $answer = AttemptAnswer::updateOrCreate(
                ['exam_attempt_id' => $attempt->id, 'question_id' => $question->id],
                ['question_option_id' => $optionId, 'answered_at' => $this->now()],
            );

            $attempt->forceFill(['last_seen_at' => $this->now()])->save();
        });

        return $answer;
    }

    public function recordEvent(ExamAttempt $attempt, AttemptEventType $type, array $meta = []): void
    {
        $attempt = $this->sync($attempt);

        if ($attempt->isSubmitted()) {
            return;
        }

        $attempt->events()->create(['type' => $type, 'meta' => $meta ?: null]);

        if ($type === AttemptEventType::TabHidden) {
            $attempt->increment('tab_switch_count');
        }
    }

    public function touch(ExamAttempt $attempt): ExamAttempt
    {
        $attempt = $this->sync($attempt);

        if (! $attempt->isSubmitted()) {
            $attempt->forceFill(['last_seen_at' => $this->now()])->save();
        }

        return $attempt;
    }

    /**
     * Menghentikan ujian dari sisi admin (paksa kirim atau diskualifikasi).
     */
    public function forceSubmit(ExamAttempt $attempt, SubmitReason $reason = SubmitReason::ForcedByAdmin): ExamAttempt
    {
        return $this->mutate($attempt, function (ExamAttempt $attempt) use ($reason) {
            $this->submit($attempt, $reason, $this->now());
        });
    }

    public function extendCurrentSection(ExamAttempt $attempt, int $seconds): ExamAttempt
    {
        return $this->mutate($attempt, function (ExamAttempt $attempt) use ($seconds) {
            $this->assertInProgress($attempt);

            $current = $this->currentAttemptSection($attempt);
            $current->forceFill(['deadline_at' => $current->deadline_at->addSeconds($seconds)])->save();
        });
    }

    /**
     * Sinkronkan dulu, lalu jalankan perubahan dalam transaksi dengan row lock.
     * Jika ujian sudah selesai, perubahan ditolak.
     */
    private function mutate(ExamAttempt $attempt, callable $callback): ExamAttempt
    {
        $attempt = $this->sync($attempt);

        return DB::transaction(function () use ($attempt, $callback) {
            $attempt = ExamAttempt::query()->lockForUpdate()->findOrFail($attempt->id);

            if ($attempt->isSubmitted()) {
                throw ExamException::alreadySubmitted();
            }

            $callback($attempt);

            return $attempt->refresh();
        }, self::TRANSACTION_ATTEMPTS);
    }

    private function openSection(ExamAttempt $attempt, ExamSection $section, CarbonInterface $at): void
    {
        AttemptSection::firstOrCreate(
            ['exam_attempt_id' => $attempt->id, 'exam_section_id' => $section->id],
            ['started_at' => $at, 'deadline_at' => $at->copy()->addSeconds($section->duration_seconds)],
        );

        $attempt->forceFill([
            'status' => AttemptStatus::InProgress,
            'current_section_id' => $section->id,
            'break_ends_at' => null,
        ])->save();
    }

    private function finishSection(ExamAttempt $attempt, AttemptSection $current, CarbonInterface $at, SubmitReason $reason): void
    {
        $current->forceFill(['finished_at' => $at->min($current->deadline_at)])->save();

        // Observasi yang masih berjalan di pilar ini ikut ditutup.
        $attempt->observations()->where('ends_at', '>', $at)->update(['ends_at' => $at]);

        $next = ExamSection::query()
            ->where('exam_id', $attempt->exam_id)
            ->where('position', '>', $current->section->position)
            ->orderBy('position')
            ->first();

        if (! $next) {
            $this->submit($attempt, $reason, $at);

            return;
        }

        $breakSeconds = (int) $attempt->exam->break_seconds;

        if ($breakSeconds <= 0) {
            $this->openSection($attempt, $next, $at);

            return;
        }

        $attempt->forceFill([
            'status' => AttemptStatus::OnBreak,
            'current_section_id' => $next->id,
            'break_ends_at' => $at->copy()->addSeconds($breakSeconds),
        ])->save();
    }

    private function submit(ExamAttempt $attempt, SubmitReason $reason, CarbonInterface $at): void
    {
        $current = $attempt->status === AttemptStatus::InProgress ? $this->currentAttemptSection($attempt) : null;

        if ($current && ! $current->isFinished()) {
            $current->forceFill(['finished_at' => $at->min($current->deadline_at)])->save();
        }

        $attempt->observations()->where('ends_at', '>', $at)->update(['ends_at' => $at]);

        $attempt->forceFill([
            'status' => AttemptStatus::Submitted,
            'submitted_at' => $at,
            'submit_reason' => $reason,
            'break_ends_at' => null,
        ])->save();

        $this->scoring->score($attempt->fresh(['sections']));

        $participant = $attempt->participant;

        if ($reason === SubmitReason::Disqualified) {
            $participant->forceFill(['status' => ParticipantStatus::Disqualified])->save();
        } elseif ($participant->status === ParticipantStatus::InExam) {
            $participant->forceFill(['status' => ParticipantStatus::Submitted])->save();
        }
    }

    private function currentAttemptSection(ExamAttempt $attempt): ?AttemptSection
    {
        return AttemptSection::query()
            ->with('section')
            ->where('exam_attempt_id', $attempt->id)
            ->where('exam_section_id', $attempt->current_section_id)
            ->whereNull('finished_at')
            ->first();
    }

    private function assertInProgress(ExamAttempt $attempt): void
    {
        if ($attempt->status !== AttemptStatus::InProgress || ! $this->currentAttemptSection($attempt)) {
            throw ExamException::notInProgress();
        }
    }

    private function assertGroupInCurrentSection(ExamAttempt $attempt, QuestionGroup $group): void
    {
        if ($group->exam_section_id !== $attempt->current_section_id) {
            throw ExamException::sectionLocked();
        }
    }

    private function now(): CarbonImmutable
    {
        return CarbonImmutable::now();
    }
}
