<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Services\Exam\CastSelectionService;
use App\Support\CurrentExam;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PublicCastController extends Controller
{
    public function __construct(private CastSelectionService $cast) {}

    // Halaman cast reveal untuk publik, hanya saat hasil dipublikasikan.
    public function show(): Response
    {
        $exam = CurrentExam::get();
        abort_unless($exam?->results_published_at, 404);

        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam);

        $card = fn (ExamAttempt $a, int $rank) => [
            'rank' => $rank,
            'full_name' => $a->participant->full_name,
            'major' => $a->participant->major,
            'building' => $a->participant->building->name,
            'score' => $a->score_total,
            'photo_url' => $a->participant->photo_path ? route('cast.photo', $a->participant) : null,
        ];

        return Inertia::render('cast', [
            'exam' => ['id' => $exam->id, 'title' => $exam->title],
            'globalKeep' => $this->cast->globalKeep(),
            'stages' => [
                [
                    'key' => 'global',
                    'title' => 'Top '.$this->cast->globalKeep().' Global',
                    'subtitle' => 'Peringkat teratas lintas gedung · lolos langsung',
                    'cards' => $global->map(fn ($a, $i) => $card($a, $i + 1))->values(),
                ],
                ...Building::orderBy('sort_order')->get()->map(fn (Building $b) => [
                    'key' => 'building-'.$b->id,
                    'title' => $b->name,
                    'subtitle' => 'Cast utama gedung',
                    'cards' => ($buildings->get($b->id) ?? collect())->map(fn ($a, $i) => $card($a, $i + 1))->values(),
                ]),
            ],
        ]);
    }

    // Foto hanya dilayani untuk peserta cast, dan hanya saat hasil dipublikasikan.
    public function photo(Participant $participant)
    {
        $exam = CurrentExam::get();
        abort_unless($exam?->results_published_at && $participant->photo_path, 404);

        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam);
        $castIds = $global->pluck('participant_id')->concat($buildings->flatten(1)->pluck('participant_id'));

        abort_unless($castIds->contains($participant->id), 404);
        abort_unless(Storage::disk('local')->exists($participant->photo_path), 404);

        return Storage::disk('local')->response($participant->photo_path);
    }
}