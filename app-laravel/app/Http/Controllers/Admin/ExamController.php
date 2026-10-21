<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ExamStatus;
use App\Enums\Pillar;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ExamController extends Controller
{
    public function index(): Response
    {
        $exams = Exam::query()
            ->withCount('attempts')
            ->with('sections')
            ->latest('id')
            ->get()
            ->map(fn (Exam $exam) => [
                'id' => $exam->id,
                'title' => $exam->title,
                'status' => $exam->status->value,
                'status_label' => $exam->status->label(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'attempts_count' => $exam->attempts_count,
                'total_minutes' => intdiv($exam->totalDurationSeconds(), 60),
            ]);

        return Inertia::render('admin/exams/index', ['exams' => $exams]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['title' => ['required', 'string', 'max:150']]);

        $exam = DB::transaction(function () use ($data) {
            $exam = Exam::create([
                'title' => $data['title'],
                'status' => ExamStatus::Draft,
                'break_seconds' => config('exam.default_break_seconds'),
            ]);

            foreach (Pillar::cases() as $i => $pillar) {
                $exam->sections()->create([
                    'pillar' => $pillar,
                    'position' => $i + 1,
                    'duration_seconds' => config('exam.default_section_seconds'),
                ]);
            }

            return $exam;
        });

        return to_route('admin.exams.edit', $exam)->with('success', 'Ujian dibuat dengan 4 pilar default.');
    }

    public function edit(Exam $exam): Response
    {
        $exam->load(['sections' => fn ($q) => $q->withCount(['questions' => fn ($q) => $q->where('questions.is_active', true)])]);

        return Inertia::render('admin/exams/edit', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'description' => $exam->description,
                'status' => $exam->status->value,
                'scheduled_at' => $exam->scheduled_at?->format('Y-m-d\TH:i'),
                'break_minutes' => intdiv($exam->break_seconds, 60),
                'announcement' => $exam->announcement,
                'results_published' => $exam->results_published_at !== null,
                'has_attempts' => $exam->attempts()->exists(),
                'sections' => $exam->sections->map(fn ($s) => [
                    'id' => $s->id,
                    'pillar' => $s->pillar->value,
                    'label' => $s->label(),
                    'position' => $s->position,
                    'minutes' => intdiv($s->duration_seconds, 60),
                    'instructions' => $s->instructions,
                    'question_count' => $s->questions_count,
                ]),
            ],
        ]);
    }

    public function update(Request $request, Exam $exam): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'scheduled_at' => ['nullable', 'date'],
            'break_minutes' => ['required', 'integer', 'min:0', 'max:60'],
            'announcement' => ['nullable', 'string', 'max:2000'],
            'sections' => ['required', 'array'],
            'sections.*.id' => ['required', Rule::exists('exam_sections', 'id')->where('exam_id', $exam->id)],
            'sections.*.minutes' => ['required', 'integer', 'min:1', 'max:300'],
            'sections.*.instructions' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($exam, $data) {
            $exam->update([
                'title' => $data['title'],
                'description' => $data['description'],
                'scheduled_at' => $data['scheduled_at'],
                'break_seconds' => $data['break_minutes'] * 60,
                'announcement' => $data['announcement'],
            ]);

            foreach ($data['sections'] as $section) {
                $exam->sections()->whereKey($section['id'])->update([
                    'duration_seconds' => $section['minutes'] * 60,
                    'instructions' => $section['instructions'],
                ]);
            }
        });

        return back()->with('success', 'Pengaturan ujian disimpan.');
    }

    public function updateStatus(Request $request, Exam $exam): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::enum(ExamStatus::class)]]);
        $status = ExamStatus::from($data['status']);

        if ($status === ExamStatus::Open) {
            // Hanya satu ujian yang boleh dibuka agar peserta tidak bingung.
            Exam::open()->whereKeyNot($exam->id)->update(['status' => ExamStatus::Closed]);
        }

        $exam->update(['status' => $status]);

        return back()->with('success', "Status ujian diubah menjadi {$status->label()}.");
    }

    public function togglePublish(Exam $exam): RedirectResponse
    {
        $exam->update(['results_published_at' => $exam->results_published_at ? null : now()]);

        return back()->with('success', $exam->results_published_at ? 'Hasil dipublikasikan ke peserta.' : 'Publikasi hasil ditarik.');
    }

    public function destroy(Exam $exam): RedirectResponse
    {
        if ($exam->attempts()->exists()) {
            return back()->with('error', 'Ujian yang sudah dikerjakan peserta tidak bisa dihapus.');
        }

        $exam->delete();

        return to_route('admin.exams.index')->with('success', 'Ujian dihapus.');
    }
}
