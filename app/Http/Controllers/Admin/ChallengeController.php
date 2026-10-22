<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ChallengeStatus;
use App\Enums\CompetitionMode;
use App\Enums\GameType;
use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Models\Challenge;
use App\Models\Participant;
use App\Models\Team;
use App\Services\Challenge\ChallengeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ChallengeController extends Controller
{
    public function __construct(private ChallengeService $service) {}

    public function index(): Response
    {
        $challenges = Challenge::withCount([
            'submissions',
            'submissions as correct_count' => fn ($q) => $q->where('is_correct', true),
        ])->orderBy('chapter')->orderBy('is_deathmatch')->orderBy('id')->get();

        return Inertia::render('admin/challenges/index', [
            'challenges' => $challenges->map(fn (Challenge $c) => $this->summary($c) + [
                'submissions_count' => $c->submissions_count,
                'correct_count' => $c->correct_count,
            ]),
            'gameTypes' => $this->gameTypes(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        $challenge = Challenge::create([
            ...$data,
            'max_attempts' => $data['max_attempts'] ?? GameType::from($data['game_type'])->defaultMaxAttempts(),
            'status' => ChallengeStatus::Locked,
        ]);

        return to_route('admin.challenges.show', $challenge)->with('success', 'Challenge dibuat. Atur roster, lalu buka game saat siap.');
    }

    public function show(Challenge $challenge): Response
    {
        $challenge->load('teams.members:id,full_name');
        $roster = $challenge->isTeamMode() ? collect() : $this->service->individualRoster($challenge);

        return Inertia::render('admin/challenges/show', [
            'challenge' => $this->summary($challenge) + [
                'answer_key' => $challenge->answer_key,
                'description' => $challenge->description,
                'opened_at' => $challenge->opened_at?->getTimestampMs(),
                'processed_at' => $challenge->processed_at?->toIso8601String(),
                'has_invites' => $challenge->invitees()->exists(),
            ],
            'leaderboard' => fn () => $this->service->leaderboard($challenge),
            'recentSubmissions' => fn () => $challenge->submissions()
                ->with(['participant:id,full_name', 'team:id,name'])
                ->latest('id')
                ->limit(15)
                ->get()
                ->map(fn ($s) => [
                    'id' => $s->id,
                    'entrant' => $s->team?->name ?? $s->participant?->full_name,
                    'answer' => $s->answer,
                    'is_correct' => $s->is_correct,
                    'elapsed_ms' => $s->elapsed_ms,
                ]),
            'teams' => $challenge->teams->map(fn (Team $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'member_ids' => $t->members->pluck('id'),
                'members' => $t->members->pluck('full_name'),
            ]),
            'rosterIds' => $roster->pluck('id'),
            'candidates' => Participant::with('building:id,name,sort_order')
                ->whereNotIn('status', [ParticipantStatus::Disqualified, ParticipantStatus::Registered, ParticipantStatus::InExam])
                ->get()
                ->sortBy(['building.sort_order', 'full_name'])
                ->values()
                ->map(fn (Participant $p) => [
                    'id' => $p->id,
                    'full_name' => $p->full_name,
                    'nim' => $p->nim,
                    'building' => $p->building->name,
                    'status' => $p->status->value,
                    'status_label' => $p->status->label(),
                ]),
            'gameTypes' => $this->gameTypes(),
            'serverNow' => now()->getTimestampMs(),
        ]);
    }

    public function update(Request $request, Challenge $challenge): RedirectResponse
    {
        $challenge->update($this->validated($request, $challenge));

        return back()->with('success', 'Pengaturan challenge disimpan.');
    }

    public function updateStatus(Request $request, Challenge $challenge): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::enum(ChallengeStatus::class)]]);
        $status = ChallengeStatus::from($data['status']);

        $this->service->changeStatus($challenge, $status);

        return back()->with('success', "Game {$challenge->title}: {$status->label()}.");
    }

    public function reset(Challenge $challenge): RedirectResponse
    {
        $this->service->reset($challenge);

        return back()->with('success', 'Semua jawaban dihapus dan game dikunci kembali.');
    }

    public function destroy(Challenge $challenge): RedirectResponse
    {
        $challenge->delete();

        return to_route('admin.challenges.index')->with('success', 'Challenge dihapus.');
    }

    public function updateRoster(Request $request, Challenge $challenge): RedirectResponse
    {
        $data = $request->validate([
            'competition_mode' => ['required', Rule::enum(CompetitionMode::class)],
            'participant_ids' => ['array'],
            'participant_ids.*' => ['integer', 'exists:participants,id'],
        ]);

        if ($challenge->submissions()->exists() && $data['competition_mode'] !== $challenge->competition_mode->value) {
            return back()->with('error', 'Mode tidak bisa diubah setelah ada jawaban masuk. Reset game terlebih dahulu.');
        }

        $challenge->update(['competition_mode' => $data['competition_mode']]);
        $challenge->invitees()->sync($data['participant_ids'] ?? []);

        return back()->with('success', 'Roster disimpan.');
    }

    public function storeTeam(Request $request, Challenge $challenge): RedirectResponse
    {
        $data = $this->validatedTeam($request, $challenge);

        $team = $challenge->teams()->create(['name' => $data['name']]);
        $team->members()->sync($data['member_ids'] ?? []);

        return back()->with('success', "Kelompok {$team->name} dibuat.");
    }

    public function updateTeam(Request $request, Team $team): RedirectResponse
    {
        $data = $this->validatedTeam($request, $team->challenge, $team);

        $team->update(['name' => $data['name']]);
        $team->members()->sync($data['member_ids'] ?? []);

        return back()->with('success', "Kelompok {$team->name} disimpan.");
    }

    public function destroyTeam(Team $team): RedirectResponse
    {
        $team->delete();

        return back()->with('success', 'Kelompok dihapus.');
    }

    public function processBracket(Request $request, Challenge $challenge): RedirectResponse
    {
        $data = $request->validate([
            'max_winners' => ['required', 'integer', 'min:1', 'max:500'],
            'failed_status' => ['required', Rule::in([ParticipantStatus::Deathmatch->value, ParticipantStatus::Eliminated->value])],
        ]);

        $result = $this->service->processBracket($challenge, $data['max_winners'], ParticipantStatus::from($data['failed_status']));
        $failedLabel = ParticipantStatus::from($data['failed_status'])->label();

        return back()->with('success', "{$result['advanced']} peserta lolos, {$result['failed']} peserta menjadi {$failedLabel}.");
    }

    private function validated(Request $request, ?Challenge $challenge = null): array
    {
        $request->merge(['code' => str($request->input('code'))->slug('_')->toString()]);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:60', Rule::unique('challenges', 'code')->ignore($challenge)],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'chapter' => ['required', 'integer', 'min:1', 'max:20'],
            'game_type' => ['required', Rule::enum(GameType::class)],
            'is_deathmatch' => ['boolean'],
            'answer_key' => ['required', 'string', 'max:200'],
            'max_winners' => ['required', 'integer', 'min:1', 'max:500'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $type = GameType::from($data['game_type']);

        if ($type === GameType::NumericalOdyssey && ! is_numeric($data['answer_key'])) {
            throw ValidationException::withMessages(['answer_key' => 'Target Numerical Odyssey harus berupa angka.']);
        }

        if ($type === GameType::Choice) {
            $data['answer_key'] = strtoupper(trim($data['answer_key']));

            if (! in_array($data['answer_key'], ['A', 'B', 'C', 'D'], true)) {
                throw ValidationException::withMessages(['answer_key' => 'Kunci pilihan ganda harus A, B, C, atau D.']);
            }
        }

        return $data;
    }

    private function validatedTeam(Request $request, Challenge $challenge, ?Team $team = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('teams', 'name')->where('challenge_id', $challenge->id)->ignore($team)],
            'member_ids' => ['array'],
            'member_ids.*' => ['integer', 'exists:participants,id'],
        ]);

        // Satu peserta hanya boleh berada di satu kelompok per challenge.
        $taken = DB::table('team_members')
            ->join('teams', 'teams.id', '=', 'team_members.team_id')
            ->where('teams.challenge_id', $challenge->id)
            ->when($team, fn ($q) => $q->where('teams.id', '!=', $team->id))
            ->whereIn('team_members.participant_id', $data['member_ids'] ?? [])
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['member_ids' => 'Ada peserta yang sudah tergabung di kelompok lain pada game ini.']);
        }

        return $data;
    }

    private function summary(Challenge $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'title' => $c->title,
            'chapter' => $c->chapter,
            'game_type' => $c->game_type->value,
            'game_type_label' => $c->game_type->label(),
            'competition_mode' => $c->competition_mode->value,
            'is_deathmatch' => $c->is_deathmatch,
            'max_winners' => $c->max_winners,
            'max_attempts' => $c->max_attempts,
            'status' => $c->status->value,
            'status_label' => $c->status->label(),
            'arena_url' => route('arena.show', $c),
        ];
    }

    private function gameTypes(): array
    {
        return collect(GameType::cases())->map(fn (GameType $t) => [
            'value' => $t->value,
            'label' => $t->label(),
            'hint' => $t->answerHint(),
            'default_max_attempts' => $t->defaultMaxAttempts(),
        ])->all();
    }
}
