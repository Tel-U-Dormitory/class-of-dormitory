<?php

namespace App\Services\Challenge;

use App\Enums\ChallengeStatus;
use App\Enums\GameType;
use App\Enums\ParticipantStatus;
use App\Exceptions\ChallengeException;
use App\Models\Challenge;
use App\Models\ChallengeSubmission;
use App\Models\Participant;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChallengeService
{
    public function __construct(private FormulaEvaluator $formula) {}

    /**
     * Peserta individu yang boleh bertanding. Jika panitia mengundang peserta tertentu,
     * hanya mereka; jika tidak, peserta yang masih bertanding (deathmatch: hanya status deathmatch).
     *
     * @return Collection<int, Participant>
     */
    public function individualRoster(Challenge $challenge): Collection
    {
        $invited = $challenge->invitees()->with('building:id,name')->get();

        if ($invited->isNotEmpty()) {
            return $invited->sortBy(['building.sort_order', 'full_name'])->values();
        }

        $statuses = $challenge->is_deathmatch ? [ParticipantStatus::Deathmatch] : ParticipantStatus::competing();

        return Participant::with('building:id,name,sort_order')
            ->whereIn('status', $statuses)
            ->get()
            ->sortBy(['building.sort_order', 'full_name'])
            ->values();
    }

    public function changeStatus(Challenge $challenge, ChallengeStatus $status): void
    {
        $challenge->forceFill([
            'status' => $status,
            // Waktu tempuh dihitung sejak game pertama kali dibuka.
            'opened_at' => $status === ChallengeStatus::Active ? ($challenge->opened_at ?? now()) : $challenge->opened_at,
            'ended_at' => $status === ChallengeStatus::Ended ? now() : null,
        ])->save();
    }

    /**
     * Mengulang game: hapus semua jawaban dan reset waktu mulai.
     */
    public function reset(Challenge $challenge): void
    {
        DB::transaction(function () use ($challenge) {
            $challenge->submissions()->delete();
            $challenge->forceFill(['status' => ChallengeStatus::Locked, 'opened_at' => null, 'ended_at' => null, 'processed_at' => null])->save();
        });
    }

    /**
     * @return array{correct: bool, message: string, attempts_left: int|null}
     */
    public function submit(Challenge $challenge, Participant|Team $entrant, string $answer, ?User $staff = null): array
    {
        return DB::transaction(function () use ($challenge, $entrant, $answer, $staff) {
            $challenge = Challenge::query()->lockForUpdate()->findOrFail($challenge->id);

            if (! $challenge->isActive()) {
                throw ChallengeException::notActive();
            }

            $this->assertInRoster($challenge, $entrant);

            $column = $entrant instanceof Team ? 'team_id' : 'participant_id';
            $previous = $challenge->submissions()->where($column, $entrant->id);

            if ((clone $previous)->where('is_correct', true)->exists()) {
                throw ChallengeException::alreadyCorrect();
            }

            $used = (clone $previous)->count();

            if ($challenge->max_attempts !== null && $used >= $challenge->max_attempts) {
                throw ChallengeException::noAttemptsLeft();
            }

            [$correct, $message, $stored] = $this->check($challenge, $answer);

            ChallengeSubmission::create([
                'challenge_id' => $challenge->id,
                $column => $entrant->id,
                'submitted_by' => $staff?->id,
                'answer' => Str::limit($stored, 490),
                'is_correct' => $correct,
                'elapsed_ms' => (int) max(0, $challenge->opened_at->diffInMilliseconds(now())),
            ]);

            return [
                'correct' => $correct,
                'message' => $message,
                'attempts_left' => $challenge->max_attempts !== null ? max(0, $challenge->max_attempts - $used - 1) : null,
            ];
        });
    }

    /**
     * Papan peringkat: entri dengan jawaban benar pertama tercepat di atas,
     * diikuti entri yang belum benar.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function leaderboard(Challenge $challenge): Collection
    {
        $column = $challenge->isTeamMode() ? 'team_id' : 'participant_id';

        $stats = $challenge->submissions()
            ->whereNotNull($column)
            ->selectRaw("{$column} as entrant_id, count(*) as attempts, min(case when is_correct = 1 then elapsed_ms end) as best_ms")
            ->groupBy($column)
            ->get()
            ->keyBy('entrant_id');

        $entrants = $challenge->isTeamMode()
            ? $challenge->teams()->with('members.building:id,name')->get()->map(fn (Team $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'subtitle' => $t->members->pluck('full_name')->join(', ') ?: 'Belum ada anggota',
                'participant_ids' => $t->members->pluck('id')->all(),
            ])
            : $this->individualRoster($challenge)->map(fn (Participant $p) => [
                'id' => $p->id,
                'name' => $p->full_name,
                'subtitle' => $p->building->name.' · '.$p->nim,
                'participant_ids' => [$p->id],
            ]);

        $rows = $entrants->map(function (array $entrant) use ($stats) {
            $stat = $stats->get($entrant['id']);

            return [
                ...$entrant,
                'attempts' => (int) ($stat->attempts ?? 0),
                'best_ms' => $stat?->best_ms !== null ? (int) $stat->best_ms : null,
            ];
        });

        $ranked = $rows->whereNotNull('best_ms')->sortBy('best_ms')->values()
            ->map(fn ($row, $i) => [...$row, 'rank' => $i + 1]);

        $unranked = $rows->whereNull('best_ms')->sortByDesc('attempts')->values()
            ->map(fn ($row) => [...$row, 'rank' => null]);

        return $ranked->concat($unranked)->values();
    }

    /**
     * Proses bracket: N tercepat yang benar → lolos; sisa roster → deathmatch/eliminasi.
     *
     * @return array{advanced: int, failed: int}
     */
    public function processBracket(Challenge $challenge, int $maxWinners, ParticipantStatus $failedStatus): array
    {
        return DB::transaction(function () use ($challenge, $maxWinners, $failedStatus) {
            $board = $this->leaderboard($challenge);

            $winnerIds = $board->whereNotNull('rank')->take($maxWinners)->pluck('participant_ids')->flatten()->unique();
            $loserIds = $board->pluck('participant_ids')->flatten()->unique()->diff($winnerIds);

            Participant::whereIn('id', $winnerIds)->update(['status' => ParticipantStatus::Advanced]);
            Participant::whereIn('id', $loserIds)->update(['status' => $failedStatus]);

            $challenge->forceFill(['processed_at' => now(), 'max_winners' => $maxWinners])->save();

            return ['advanced' => $winnerIds->count(), 'failed' => $loserIds->count()];
        });
    }

    /**
     * @return array{0: bool, 1: string, 2: string}
     */
    private function check(Challenge $challenge, string $answer): array
    {
        if ($challenge->game_type === GameType::NumericalOdyssey) {
            $tokens = json_decode($answer, true);
            $tokens = is_array($tokens) ? array_values(array_map('strval', $tokens)) : [];
            $formula = implode('', $tokens);

            if ($problem = $this->formula->validate($tokens)) {
                return [false, $problem, $formula];
            }

            $value = $this->formula->evaluate($tokens);

            if ($value === null) {
                return [false, 'Rumus tidak valid.', $formula];
            }

            $display = $formula.' = '.rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.');

            return [$this->formula->matches($tokens, (float) $challenge->answer_key), $display, $display];
        }

        $normalize = fn (string $v) => Str::lower(preg_replace('/\s+/', ' ', trim($v)));
        $correct = $normalize($answer) === $normalize($challenge->answer_key);

        return [$correct, $correct ? 'Jawaban benar.' : 'Jawaban salah.', trim($answer)];
    }

    private function assertInRoster(Challenge $challenge, Participant|Team $entrant): void
    {
        $ok = $entrant instanceof Team
            ? $challenge->isTeamMode() && $entrant->challenge_id === $challenge->id
            : ! $challenge->isTeamMode() && $this->individualRoster($challenge)->contains('id', $entrant->id);

        if (! $ok) {
            throw ChallengeException::notInRoster();
        }
    }
}
