<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParticipantStatus;
use App\Enums\SubmitReason;
use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Services\Exam\ExamEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ParticipantController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'building' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::enum(ParticipantStatus::class)],
        ]);

        $participants = Participant::query()
            ->with('building:id,name')
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('full_name', 'like', "%{$search}%")
                ->orWhere('nim', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->when($filters['building'] ?? null, fn ($q, $building) => $q->where('building_id', $building))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Participant $p) => [
                'id' => $p->id,
                'full_name' => $p->full_name,
                'nim' => $p->nim,
                'email' => $p->email,
                'building' => $p->building->name,
                'room_number' => $p->room_number,
                'major' => $p->major,
                'status' => $p->status->value,
                'status_label' => $p->status->label(),
                'photo_url' => $p->photo_path ? route('admin.participants.photo', $p) : null,
                'created_at' => $p->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/participants/index', [
            'participants' => $participants,
            'filters' => $filters,
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'statuses' => collect(ParticipantStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
        ]);
    }

    public function show(Participant $participant): Response
    {
        $participant->load('building');

        $attempts = ExamAttempt::with(['exam:id,title', 'sections.section'])
            ->where('participant_id', $participant->id)
            ->latest('id')
            ->get()
            ->map(fn (ExamAttempt $a) => [
                'id' => $a->id,
                'exam' => $a->exam->title,
                'status' => $a->status->value,
                'status_label' => $a->status->label(),
                'started_at' => $a->started_at->toIso8601String(),
                'submitted_at' => $a->submitted_at?->toIso8601String(),
                'submit_reason' => $a->submit_reason?->label(),
                'score_total' => $a->score_total,
                'tab_switch_count' => $a->tab_switch_count,
                'sections' => $a->sections->map(fn ($s) => [
                    'label' => $s->section->label(),
                    'score' => $s->score,
                    'correct' => $s->correct_count,
                    'wrong' => $s->wrong_count,
                ]),
            ]);

        return Inertia::render('admin/participants/show', [
            'participant' => [
                'id' => $participant->id,
                'full_name' => $participant->full_name,
                'nim' => $participant->nim,
                'email' => $participant->email,
                'building' => $participant->building->name,
                'room_number' => $participant->room_number,
                'major' => $participant->major,
                'achievements' => $participant->achievements ?? [],
                'status' => $participant->status->value,
                'status_label' => $participant->status->label(),
                'photo_url' => $participant->photo_path ? route('admin.participants.photo', $participant) : null,
                'token_issued_at' => $participant->token_issued_at?->toIso8601String(),
                'last_login_at' => $participant->last_login_at?->toIso8601String(),
                'created_at' => $participant->created_at->toIso8601String(),
            ],
            'attempts' => $attempts,
            'statuses' => collect(ParticipantStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'newToken' => session('new_token'),
        ]);
    }

    public function resetToken(Participant $participant): RedirectResponse
    {
        $token = $participant->issueToken();

        // Sesi lama ikut keluar karena token lama tidak berlaku lagi.
        $participant->forceFill(['current_session_id' => null])->save();

        return back()->with('new_token', $token)->with('success', 'Token baru dibuat. Berikan ke peserta; token hanya ditampilkan sekali.');
    }

    public function updateStatus(Request $request, Participant $participant, ExamEngine $engine): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::enum(ParticipantStatus::class)]]);
        $status = ParticipantStatus::from($data['status']);

        if ($status === ParticipantStatus::Disqualified) {
            $participant->attempts()->whereIn('status', ['in_progress', 'on_break'])->get()
                ->each(fn (ExamAttempt $attempt) => $engine->forceSubmit($attempt, SubmitReason::Disqualified));
        }

        $participant->update(['status' => $status]);

        return back()->with('success', "Status peserta diubah menjadi {$status->label()}.");
    }

    public function destroy(Participant $participant): RedirectResponse
    {
        if ($participant->photo_path) {
            Storage::disk('local')->delete($participant->photo_path);
        }

        $participant->delete();

        return to_route('admin.participants.index')->with('success', 'Peserta dihapus beserta seluruh data ujiannya.');
    }
}
