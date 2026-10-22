<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Support\CurrentExam;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $participant = $request->user('participant')->load('building');
        $exam = CurrentExam::get()?->load('sections');

        $attempt = $exam
            ? ExamAttempt::with('sections.section')->where('exam_id', $exam->id)->where('participant_id', $participant->id)->first()
            : null;

        $resultsPublished = $exam?->results_published_at !== null;

        return Inertia::render('participant/dashboard', [
            'participant' => [
                'full_name' => $participant->full_name,
                'nim' => $participant->nim,
                'building' => $participant->building->name,
                'room_number' => $participant->room_number,
                'major' => $participant->major,
                'status' => $participant->status->value,
                'status_label' => $participant->status->label(),
                'photo_url' => $participant->photo_path ? route('participant.photo') : null,
            ],
            'exam' => $exam ? [
                'title' => $exam->title,
                'description' => $exam->description,
                'status' => $exam->status->value,
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'announcement' => $exam->announcement,
                'total_minutes' => intdiv($exam->totalDurationSeconds(), 60),
                'sections' => $exam->sections->map(fn ($s) => [
                    'pillar' => $s->pillar->value,
                    'label' => $s->label(),
                    'minutes' => intdiv($s->duration_seconds, 60),
                ]),
            ] : null,
            'attempt' => $attempt ? [
                'status' => $attempt->status->value,
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'result' => $resultsPublished && $attempt->isSubmitted() ? [
                    'score_total' => $attempt->score_total,
                    'sections' => $attempt->sections->map(fn ($s) => [
                        'label' => $s->section->label(),
                        'score' => $s->score,
                    ]),
                ] : null,
            ] : null,
            'resultsPublished' => $resultsPublished,
        ]);
    }

    public function photo(Request $request)
    {
        $path = $request->user('participant')->photo_path;
        abort_unless($path, 404);

        return Storage::disk('local')->response($path);
    }
}
