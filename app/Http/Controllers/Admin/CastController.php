<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Services\Exam\CastSelectionService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CastController extends Controller
{
    public function __construct(private CastSelectionService $cast) {}

    /**
     * Panggung cast reveal (mode presentasi layar penuh).
     */
    public function reveal(Exam $exam): Response
    {
        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam);

        $card = fn (ExamAttempt $a, int $rank) => [
            'rank' => $rank,
            'full_name' => $a->participant->full_name,
            'major' => $a->participant->major,
            'building' => $a->participant->building->name,
            'score' => $a->score_total,
            'photo_url' => $a->participant->photo_path ? route('admin.participants.photo', $a->participant) : null,
        ];

        return Inertia::render('admin/cast-reveal', [
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

    public function apply(Exam $exam): RedirectResponse
    {
        $count = $this->cast->apply($exam);

        return back()->with('success', "{$count} peserta ditetapkan sebagai cast.");
    }
}
