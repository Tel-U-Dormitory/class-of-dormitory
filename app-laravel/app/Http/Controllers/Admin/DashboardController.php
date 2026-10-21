<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AttemptStatus;
use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Support\CurrentExam;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function updateRegistration(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'open' => ['required', 'boolean'],
            'closed_message' => ['nullable', 'string', 'max:300'],
        ]);

        Settings::set('registration_open', $data['open']);

        if (filled($data['closed_message'] ?? null)) {
            Settings::set('registration_closed_message', $data['closed_message']);
        }

        return back()->with('success', $data['open'] ? 'Pendaftaran dibuka.' : 'Pendaftaran ditutup.');
    }

    public function __invoke(): Response
    {
        $exam = CurrentExam::get() ?? Exam::latest('id')->first();

        $attemptCounts = $exam
            ? ExamAttempt::where('exam_id', $exam->id)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
            : collect();

        $statusCounts = Participant::selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('admin/dashboard', [
            'exam' => $exam ? [
                'id' => $exam->id,
                'title' => $exam->title,
                'status' => $exam->status->value,
                'status_label' => $exam->status->label(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'question_count' => $exam->questionGroups()->join('questions', 'questions.question_group_id', '=', 'question_groups.id')->where('questions.is_active', true)->count(),
            ] : null,
            'registration' => [
                'open' => Settings::registrationOpen(),
                'closed_message' => Settings::get('registration_closed_message'),
            ],
            'stats' => [
                'participants' => Participant::count(),
                'in_progress' => (int) ($attemptCounts[AttemptStatus::InProgress->value] ?? 0) + (int) ($attemptCounts[AttemptStatus::OnBreak->value] ?? 0),
                'submitted' => (int) ($attemptCounts[AttemptStatus::Submitted->value] ?? 0),
                'tab_switches' => $exam ? (int) ExamAttempt::where('exam_id', $exam->id)->sum('tab_switch_count') : 0,
            ],
            'statusBreakdown' => collect(ParticipantStatus::cases())->map(fn ($s) => [
                'label' => $s->label(),
                'value' => $s->value,
                'total' => (int) ($statusCounts[$s->value] ?? 0),
            ]),
            'buildings' => Building::withCount('participants')->orderBy('sort_order')->get(['id', 'name'])
                ->map(fn ($b) => ['name' => $b->name, 'total' => $b->participants_count]),
            'recentParticipants' => Participant::with('building:id,name')->latest()->limit(6)->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'full_name' => $p->full_name,
                    'nim' => $p->nim,
                    'building' => $p->building->name,
                    'created_at' => $p->created_at->toIso8601String(),
                ]),
        ]);
    }
}
