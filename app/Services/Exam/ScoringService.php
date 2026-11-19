<?php

namespace App\Services\Exam;

use App\Models\AttemptAnswer;
use App\Models\AttemptSection;
use App\Models\ExamAttempt;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Menghitung skor: benar +points, salah -penalty, kosong 0 (nilai per soal).
 */
class ScoringService
{
    public function score(ExamAttempt $attempt): void
    {
        $attempt->loadMissing('sections');

        $answers = $attempt->answers()
            ->with(['question:id,question_group_id,points,penalty', 'question.group:id,exam_section_id', 'option:id,question_id,is_correct'])
            ->get();

        $perSection = [];
        $scored = [];

        foreach ($answers as $answer) {
            [$isCorrect, $score] = $this->scoreAnswer($answer);

            $scored[] = array_merge($answer->getAttributes(), [
                'is_correct' => $isCorrect,
                'score' => $score,
                'updated_at' => now(),
            ]);

            $sectionId = $answer->question->group->exam_section_id;
            $perSection[$sectionId] ??= ['score' => 0, 'correct' => 0, 'wrong' => 0];
            $perSection[$sectionId]['score'] += $score;
            $perSection[$sectionId]['correct'] += $isCorrect === true ? 1 : 0;
            $perSection[$sectionId]['wrong'] += $isCorrect === false ? 1 : 0;
        }

        foreach (array_chunk($scored, 250) as $chunk) {
            AttemptAnswer::upsert($chunk, ['exam_attempt_id', 'question_id'], ['is_correct', 'score', 'updated_at']);
        }

        $duration = 0;

        foreach ($attempt->sections as $attemptSection) {
            $stats = $perSection[$attemptSection->exam_section_id] ?? ['score' => 0, 'correct' => 0, 'wrong' => 0];
            $scoreWeb = $stats['score'];

            $finalScore = match ($attemptSection->adjustment_type) {
                'addition' => $scoreWeb + (int) $attemptSection->manual_score,
                'overwrite' => (int) $attemptSection->manual_score,
                default => $scoreWeb,
            };

            $attemptSection->forceFill([
                'score_web' => $scoreWeb,
                'score' => $finalScore,
                'correct_count' => $stats['correct'],
                'wrong_count' => $stats['wrong'],
            ])->save();

            if ($attemptSection->finished_at) {
                $duration += (int) $attemptSection->started_at->diffInSeconds($attemptSection->finished_at);
            }
        }

        $attempt->forceFill([
            'score_total' => (int) $attempt->sections->sum('score'),
            'correct_count' => array_sum(array_column($perSection, 'correct')),
            'wrong_count' => array_sum(array_column($perSection, 'wrong')),
            'duration_seconds' => $duration,
        ])->save();
    }

    /**
     * Menyesuaikan nilai pilar peserta secara manual (tambah atau timpa).
     */
    public function adjustSection(
        AttemptSection $attemptSection,
        ?string $adjustmentType,
        int $manualScore,
        ?string $notes,
        ?User $admin = null
    ): AttemptSection {
        return DB::transaction(function () use ($attemptSection, $adjustmentType, $manualScore, $notes, $admin) {
            $attemptSection = AttemptSection::query()->lockForUpdate()->findOrFail($attemptSection->id);
            $attempt = ExamAttempt::query()->lockForUpdate()->findOrFail($attemptSection->exam_attempt_id);

            $scoreWeb = $attemptSection->score_web ?? $attemptSection->score ?? 0;

            $normalizedType = in_array($adjustmentType, ['addition', 'overwrite'], true) ? $adjustmentType : null;
            $finalManualScore = $normalizedType !== null ? $manualScore : 0;

            $finalScore = match ($normalizedType) {
                'addition' => $scoreWeb + $finalManualScore,
                'overwrite' => $finalManualScore,
                default => $scoreWeb,
            };

            $attemptSection->forceFill([
                'score_web' => $scoreWeb,
                'adjustment_type' => $normalizedType,
                'manual_score' => $finalManualScore,
                'adjustment_notes' => $normalizedType !== null ? $notes : null,
                'adjusted_by' => $normalizedType !== null ? $admin?->id : null,
                'adjusted_at' => $normalizedType !== null ? now() : null,
                'score' => $finalScore,
            ])->save();

            $newTotal = (int) $attempt->sections()->sum('score');

            $attempt->forceFill([
                'score_total' => $newTotal,
            ])->save();

            return $attemptSection->fresh(['adjuster']);
        });
    }

    /**
     * @return array{0: bool|null, 1: int}
     */
    private function scoreAnswer(AttemptAnswer $answer): array
    {
        if (! $answer->option) {
            return [null, 0];
        }

        return $answer->option->is_correct
            ? [true, (int) $answer->question->points]
            : [false, -1 * (int) $answer->question->penalty];
    }
}
