<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Participant;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Perjalanan peserta setelah seleksi: cast → lolos / deathmatch / tereliminasi.
 */
class BracketController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $statuses = [...ParticipantStatus::competing(), ParticipantStatus::Eliminated];

        $participants = Participant::with('building:id,name,sort_order')
            ->whereIn('status', $statuses)
            ->get()
            ->sortBy(['building.sort_order', 'full_name'])
            ->values();

        return Inertia::render('admin/bracket', [
            'participants' => $participants->map(fn (Participant $p) => [
                'id' => $p->id,
                'full_name' => $p->full_name,
                'nim' => $p->nim,
                'building_id' => $p->building_id,
                'building' => $p->building->name,
                'status' => $p->status->value,
                'status_label' => $p->status->label(),
                'photo_url' => $p->photo_path ? route('admin.participants.photo', $p) : null,
            ]),
            'counts' => collect($statuses)->mapWithKeys(fn ($s) => [$s->value => $participants->where('status', $s)->count()]),
            'statuses' => collect($statuses)->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
        ]);
    }
}
