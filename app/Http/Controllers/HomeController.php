<?php

namespace App\Http\Controllers;

use App\Enums\Pillar;
use App\Models\ExamAttempt;
use App\Services\Exam\CastSelectionService;
use App\Support\CurrentExam;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request, CastSelectionService $castService): Response
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

        return Inertia::render('welcome', [
            'exam' => $exam ? [
                'title' => $exam->title,
                'description' => $exam->description,
                'is_open' => $exam->isOpen(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'total_minutes' => intdiv($exam->totalDurationSeconds(), 60),
            ] : null,
            'pillars' => collect(Pillar::cases())->map(fn (Pillar $p) => [
                'value' => $p->value,
                'label' => $p->label(),
                'description' => $p->description(),
            ]),
            'resultsPublished' => $published,
            'result' => $result,
            // Pintasan cast tampil jika dipublikasikan dan sudah ada peserta yang selesai ujian
            'castOpen' => $published && $castService->ranked($exam)->isNotEmpty(),
        ]);
    }
}