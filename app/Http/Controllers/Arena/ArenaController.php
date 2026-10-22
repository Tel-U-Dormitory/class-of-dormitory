<?php

namespace App\Http\Controllers\Arena;

use App\Enums\GameType;
use App\Http\Controllers\Controller;
use App\Models\Challenge;
use App\Models\Participant;
use App\Models\Team;
use App\Services\Challenge\ChallengeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Layar game di panggung (kiosk). Dibuka oleh panitia yang login; peserta memilih namanya
 * lalu menjawab. Kunci jawaban dan penilaian sepenuhnya di server.
 */
class ArenaController extends Controller
{
    public function __construct(private ChallengeService $service) {}

    public function show(Challenge $challenge): Response
    {
        $challenge->load('teams.members:id,full_name');

        $entrants = $challenge->isTeamMode()
            ? $challenge->teams->map(fn (Team $t) => [
                'id' => $t->id,
                'label' => $t->name,
                'detail' => $t->members->pluck('full_name')->join(', ') ?: 'Belum ada anggota',
            ])
            : $this->service->individualRoster($challenge)->map(fn (Participant $p) => [
                'id' => $p->id,
                'label' => $p->full_name,
                'detail' => $p->building->name.' · '.$p->nim,
            ]);

        return Inertia::render($challenge->game_type === GameType::NumericalOdyssey ? 'arena/numerical-odyssey' : 'arena/game', [
            'challenge' => [
                'code' => $challenge->code,
                'title' => $challenge->title,
                'description' => $challenge->description,
                'chapter' => $challenge->chapter,
                'game_type' => $challenge->game_type->value,
                'competition_mode' => $challenge->competition_mode->value,
                'is_deathmatch' => $challenge->is_deathmatch,
                'status' => $challenge->status->value,
                'max_attempts' => $challenge->max_attempts,
            ],
            'entrants' => $entrants->values(),
        ]);
    }

    public function submit(Request $request, Challenge $challenge): JsonResponse
    {
        $data = $request->validate([
            'entrant_id' => ['required', 'integer'],
            'answer' => ['required_without:tokens', 'nullable', 'string', 'max:200'],
            'tokens' => ['required_without:answer', 'nullable', 'array', 'max:60'],
            'tokens.*' => ['string', 'max:3'],
        ]);

        $entrant = $challenge->isTeamMode()
            ? Team::where('challenge_id', $challenge->id)->findOrFail($data['entrant_id'])
            : Participant::findOrFail($data['entrant_id']);

        $answer = $challenge->game_type === GameType::NumericalOdyssey
            ? json_encode(array_values($data['tokens'] ?? []))
            : (string) $data['answer'];

        return response()->json($this->service->submit($challenge, $entrant, $answer, $request->user()));
    }
}
