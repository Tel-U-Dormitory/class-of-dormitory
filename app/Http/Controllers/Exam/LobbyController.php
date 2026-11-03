<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Services\Exam\ExamEngine;
use App\Support\CurrentExam;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LobbyController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        $participant = $request->user('participant');
        $exam = CurrentExam::get()?->load('sections');

        $attempt = $exam
            ? ExamAttempt::where('exam_id', $exam->id)->where('participant_id', $participant->id)->first()
            : null;

        if ($attempt?->isSubmitted()) {
            return to_route('exam.finished');
        }

        return Inertia::render('exam/lobby', [
            'exam' => $exam ? [
                'title' => $exam->title,
                'is_open' => $exam->isOpen(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'announcement' => $exam->announcement,
                'break_minutes' => intdiv($exam->break_seconds, 60),
                'sections' => $exam->sections->map(fn ($s) => [
                    'pillar' => $s->pillar->value,
                    'label' => $s->label(),
                    'minutes' => intdiv($s->duration_seconds, 60),
                    'description' => $s->pillar->description(),
                ]),
            ] : null,
            'hasActiveAttempt' => $attempt !== null,
        ]);
    }

    public function start(Request $request, ExamEngine $engine): RedirectResponse
    {
        $exam = CurrentExam::get();
        abort_unless($exam, 404);

        $engine->start($request->user('participant'), $exam);

        return to_route('exam.session');
    }
}
