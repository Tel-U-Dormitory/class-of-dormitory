<?php

namespace App\Http\Controllers;

use App\Enums\Pillar;
use App\Models\Documentation;
use App\Models\ExamAttempt;
use App\Services\Exam\CastSelectionService;
use App\Support\CurrentExam;
use App\Support\Settings;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request, CastSelectionService $castService): Response
    {
        return Inertia::render('welcome', [
            'pillars' => collect(Pillar::cases())->map(fn (Pillar $p) => [
                'value' => $p->value,
                'label' => $p->label(),
                'description' => $p->description(),
            ]),
            'landing' => Inertia::defer(fn () => $this->landing($request, $castService)),
        ]);
    }

    private function landing(Request $request, CastSelectionService $castService): array
    {
        $exam = CurrentExam::get()?->load('sections');
        $published = $exam?->results_published_at !== null;

        // Skor milik peserta yang sedang login (opsional, tampil sebagai kartu di landing)
        $result = null;
        $participant = $request->user('participant');
        if ($published && $participant) {
            $attempt = ExamAttempt::with('sections.section')
                ->where('exam_id', $exam->id)
                ->where('participant_id', $participant->id)
                ->first();

            if ($attempt?->isSubmitted()) {
                $result = [
                    'score_total' => $attempt->score_total,
                    'sections' => $attempt->sections->map(fn ($s) => [
                        'label' => $s->section->label(),
                        'score' => $s->score,
                    ]),
                ];
            }
        }

        // Foto dokumentasi: maksimal 4 teratas. Bila tabelnya belum ada (migration belum dijalankan),
        // beranda tetap tampil dengan foto bawaan.
        try {
            $documentation = Documentation::ordered()->limit(Documentation::LANDING_LIMIT)->get()->map(fn (Documentation $d) => [
                'id' => $d->id,
                'caption' => $d->caption,
                'url' => $d->imageUrl(),
            ])->all();
        } catch (QueryException) {
            $documentation = [];
        }

        return [
            'exam' => $exam ? [
                'title' => $exam->title,
                'description' => $exam->description,
                'is_open' => $exam->isOpen(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'total_minutes' => intdiv($exam->totalDurationSeconds(), 60),
            ] : null,
            'resultsPublished' => $published,
            'documentation' => $documentation,
            'documentationTitle' => Settings::get('documentation_title'),
            'result' => $result,
            // Pintasan cast tampil jika dipublikasikan dan sudah ada peserta yang selesai ujian
            'castOpen' => $published && $castService->hasRanked($exam),
        ];
    }
}
