<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AttemptStatus;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Services\Exam\ExamEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MonitorController extends Controller
{
    public function show(Exam $exam, ExamEngine $engine): Response
    {
        $exam->load('sections');

        // Pastikan status yang dipantau mutakhir walau peserta sedang offline.
        ExamAttempt::where('exam_id', $exam->id)
            ->whereIn('status', [AttemptStatus::InProgress, AttemptStatus::OnBreak])
            ->get()
            ->each(fn (ExamAttempt $attempt) => $engine->sync($attempt));

        $questionCounts = Question::query()
            ->join('question_groups', 'question_groups.id', '=', 'questions.question_group_id')
            ->where('questions.is_active', true)
            ->whereIn('question_groups.exam_section_id', $exam->sections->pluck('id'))
            ->selectRaw('question_groups.exam_section_id as section_id, count(*) as total')
            ->groupBy('question_groups.exam_section_id')
            ->pluck('total', 'section_id');

        $attempts = ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->with(['participant:id,full_name,nim,building_id', 'participant.building:id,name', 'sections'])
            ->withCount(['answers as answered_count' => fn ($q) => $q->whereNotNull('question_option_id')])
            ->orderByRaw("FIELD(status, 'in_progress', 'on_break', 'submitted')")
            ->orderByDesc('tab_switch_count')
            ->get()
            ->map(function (ExamAttempt $a) use ($exam) {
                $current = $a->sections->firstWhere('exam_section_id', $a->current_section_id);

                return [
                    'id' => $a->id,
                    'participant' => [
                        'id' => $a->participant->id,
                        'full_name' => $a->participant->full_name,
                        'nim' => $a->participant->nim,
                        'building' => $a->participant->building->name,
                    ],
                    'status' => $a->status->value,
                    'status_label' => $a->status->label(),
                    'current_section' => $exam->sections->firstWhere('id', $a->current_section_id)?->label(),
                    'section_index' => $exam->sections->search(fn ($s) => $s->id === $a->current_section_id),
                    'deadline_at' => $a->status === AttemptStatus::InProgress ? $current?->deadline_at?->getTimestampMs() : null,
                    'break_ends_at' => $a->break_ends_at?->getTimestampMs(),
                    'answered_count' => $a->answered_count,
                    'tab_switch_count' => $a->tab_switch_count,
                    'last_seen_at' => $a->last_seen_at?->getTimestampMs(),
                    'score_total' => $a->score_total,
                    'submit_reason' => $a->submit_reason?->label(),
                ];
            });

        return Inertia::render('admin/exams/monitor', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'status' => $exam->status->value,
                'status_label' => $exam->status->label(),
                'sections' => $exam->sections->map(fn ($s) => ['id' => $s->id, 'label' => $s->label()]),
                'total_questions' => (int) $questionCounts->sum(),
            ],
            'attempts' => $attempts,
            'serverNow' => now()->getTimestampMs(),
            'pollSeconds' => config('exam.monitor_poll_seconds'),
        ]);
    }

    public function forceSubmit(Exam $exam, ExamAttempt $attempt, ExamEngine $engine): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);

        $engine->forceSubmit($attempt);

        return back()->with('success', 'Ujian peserta dihentikan dan dinilai.');
    }

    public function extend(Request $request, Exam $exam, ExamAttempt $attempt, ExamEngine $engine): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);

        $data = $request->validate(['minutes' => ['required', 'integer', 'min:1', 'max:60']]);

        $engine->extendCurrentSection($attempt, $data['minutes'] * 60);

        return back()->with('success', "Waktu pilar ditambah {$data['minutes']} menit.");
    }
}
