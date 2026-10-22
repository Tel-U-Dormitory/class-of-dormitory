<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Models\ExamAttempt;
use App\Services\Exam\ExamEngine;
use App\Services\Exam\ExamSessionPresenter;
use App\Support\CurrentExam;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SessionController extends Controller
{
    use ResolvesAttempt;

    public function show(Request $request, ExamEngine $engine, ExamSessionPresenter $presenter): Response|RedirectResponse
    {
        $exam = CurrentExam::get();
        $attempt = $exam
            ? ExamAttempt::where('exam_id', $exam->id)->where('participant_id', $request->user('participant')->id)->first()
            : null;

        if (! $attempt) {
            return to_route('exam.lobby');
        }

        $attempt = $engine->touch($attempt);

        if ($attempt->isSubmitted()) {
            return to_route('exam.finished');
        }

        return Inertia::render('exam/session', $presenter->present($attempt));
    }

    public function finishSection(Request $request, ExamEngine $engine): RedirectResponse
    {
        $engine->finishCurrentSection($this->attempt($request));

        return to_route('exam.session');
    }

    public function skipBreak(Request $request, ExamEngine $engine): RedirectResponse
    {
        $engine->skipBreak($this->attempt($request));

        return to_route('exam.session');
    }

    public function finished(Request $request): Response|RedirectResponse
    {
        $attempt = $this->attempt($request)->load(['exam', 'sections.section']);

        if (! $attempt->isSubmitted()) {
            return to_route('exam.session');
        }

        $published = $attempt->exam->results_published_at !== null;

        return Inertia::render('exam/finished', [
            'exam' => ['title' => $attempt->exam->title],
            'submittedAt' => $attempt->submitted_at->toIso8601String(),
            'submitReason' => $attempt->submit_reason?->label(),
            'answeredCount' => $attempt->answers()->whereNotNull('question_option_id')->count(),
            'result' => $published ? [
                'score_total' => $attempt->score_total,
                'sections' => $attempt->sections->map(fn ($s) => ['label' => $s->section->label(), 'score' => $s->score]),
            ] : null,
        ]);
    }
}
