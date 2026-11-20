<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Pillar;
use App\Http\Controllers\Controller;
use App\Models\AttemptSection;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamSection;
use App\Services\Exam\CastSelectionService;
use App\Services\Exam\ScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultController extends Controller
{
    public function __construct(private CastSelectionService $cast) {}

    public function index(Request $request, Exam $exam): Response
    {
        $exam->load('sections');
        $building = $request->integer('building') ?: null;

        return Inertia::render('admin/exams/results', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'results_published' => $exam->results_published_at !== null,
                'cast_applied' => ExamAttempt::where('exam_id', $exam->id)->whereNotNull('cast_type')->exists(),
                'sections' => $exam->sections->map(fn ($s) => ['id' => $s->id, 'label' => $s->label()]),
            ],
            'results' => Inertia::defer(fn () => $this->resultsPage($request, $exam, $building)),
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'filters' => ['building' => $building],
            'castRules' => ['global_keep' => $this->cast->globalKeep(), 'per_building' => $this->cast->perBuilding()],
            'pillars' => collect(Pillar::cases())->map(fn ($p) => ['value' => $p->value, 'label' => $p->label()]),
        ]);
    }

    private function resultsPage(Request $request, Exam $exam, ?int $building): array
    {
        // Cast and ranks must use the entire cohort, before filtering or pagination.
        $ranked = $this->cast->ranked($exam);
        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam, $ranked);
        $preview = $global->mapWithKeys(fn ($a) => [$a->id => 'global'])
            ->union($buildings->flatten(1)->mapWithKeys(fn ($a) => [$a->id => 'building']));
        $buildingCounters = [];
        $ranks = $ranked->values()->mapWithKeys(function ($attempt, $index) use (&$buildingCounters) {
            $id = $attempt->participant->building_id;
            $buildingCounters[$id] = ($buildingCounters[$id] ?? 0) + 1;

            return [$attempt->id => ['rank' => $index + 1, 'building_rank' => $buildingCounters[$id]]];
        });
        $filtered = $building ? $ranked->filter(fn ($a) => $a->participant->building_id === $building)->values() : $ranked;
        $lastPage = max(1, (int) ceil($filtered->count() / 50));
        $page = min(max(1, $request->integer('page', 1)), $lastPage);
        $rows = $this->ranked($exam, $filtered->forPage($page, 50))->map(fn ($row) => [
            ...$row,
            ...$ranks[$row['attempt_id']],
            'cast_preview' => $preview->get($row['attempt_id']),
        ]);

        return ['rows' => $rows, 'page' => $page, 'last_page' => $lastPage, 'total' => $filtered->count()];
    }

    public function export(Exam $exam): StreamedResponse
    {
        $exam->load('sections');
        $rows = $this->ranked($exam);

        return response()->streamDownload(function () use ($rows, $exam) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Peringkat', 'Peringkat Gedung', 'Nama', 'NIM', 'Gedung', 'Prodi',
                ...$exam->sections->map->label(),
                'Total', 'Benar', 'Salah', 'Durasi (detik)', 'Pindah Tab', 'Keterangan',
            ]);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['rank'], $row['building_rank'], $row['full_name'], $row['nim'], $row['building'], $row['major'],
                    ...$exam->sections->map(fn ($s) => $row['section_scores'][$s->id] ?? 0),
                    $row['score_total'], $row['correct_count'], $row['wrong_count'], $row['duration_seconds'],
                    $row['tab_switch_count'], $row['submit_reason'],
                ]);
            }

            fclose($out);
        }, 'hasil-'.str($exam->title)->slug().'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function specialist(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);

        $data = $request->validate(['pillar' => ['nullable', Rule::enum(Pillar::class)]]);
        $attempt->update(['specialist_pillar' => $data['pillar'] ?? null]);

        return back()->with('success', $data['pillar'] ?? null ? 'Spesialis ditandai.' : 'Tanda spesialis dihapus.');
    }

    /**
     * Urutan: skor total tertinggi, lalu durasi pengerjaan tersingkat. Peserta didiskualifikasi tidak diperingkat.
     */
    private function ranked(Exam $exam, ?Collection $ranked = null): Collection
    {
        $ranked ??= $this->cast->ranked($exam);
        $ranked->loadMissing('sections');

        $rows = $ranked
            ->values()
            ->map(fn (ExamAttempt $a, int $i) => [
                'attempt_id' => $a->id,
                'rank' => $i + 1,
                'participant_id' => $a->participant->id,
                'full_name' => $a->participant->full_name,
                'nim' => $a->participant->nim,
                'major' => $a->participant->major,
                'building_id' => $a->participant->building_id,
                'building' => $a->participant->building->name,
                'section_scores' => $a->sections->pluck('score', 'exam_section_id'),
                'section_adjustments' => $a->sections->keyBy('exam_section_id')->map(fn ($s) => [
                    'attempt_section_id' => $s->id,
                    'score' => $s->score ?? 0,
                    'score_web' => $s->score_web ?? $s->score ?? 0,
                    'adjustment_type' => $s->adjustment_type,
                    'manual_score' => $s->manual_score ?? 0,
                    'adjustment_notes' => $s->adjustment_notes,
                ]),
                'score_total' => $a->score_total,
                'correct_count' => $a->correct_count,
                'wrong_count' => $a->wrong_count,
                'duration_seconds' => $a->duration_seconds,
                'tab_switch_count' => $a->tab_switch_count,
                'submit_reason' => $a->submit_reason?->label(),
                'cast_type' => $a->cast_type,
                'specialist_pillar' => $a->specialist_pillar?->value,
            ]);

        $buildingCounters = [];

        return $rows->map(function (array $row) use (&$buildingCounters) {
            $buildingCounters[$row['building_id']] = ($buildingCounters[$row['building_id']] ?? 0) + 1;

            return [...$row, 'building_rank' => $buildingCounters[$row['building_id']]];
        });
    }

    public function review(Exam $exam, ExamAttempt $attempt): Response
    {
        abort_unless($attempt->exam_id === $exam->id, 404);

        $attempt->load([
            'participant.building',
        ]);

        return Inertia::render('admin/exams/review', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
            ],
            'attempt' => [
                'id' => $attempt->id,
                'status' => $attempt->status->value,
                'status_label' => $attempt->status->label(),
                'score_total' => $attempt->score_total,
                'correct_count' => $attempt->correct_count,
                'wrong_count' => $attempt->wrong_count,
                'duration_seconds' => $attempt->duration_seconds,
                'tab_switch_count' => $attempt->tab_switch_count,
                'submit_reason' => $attempt->submit_reason?->label(),
                'started_at' => $attempt->started_at->toIso8601String(),
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            ],
            'participant' => [
                'id' => $attempt->participant->id,
                'full_name' => $attempt->participant->full_name,
                'nim' => $attempt->participant->nim,
                'building' => $attempt->participant->building->name,
                'room_number' => $attempt->participant->room_number,
                'major' => $attempt->participant->major,
            ],
            'sections' => Inertia::defer(fn () => $this->reviewSections($exam, $attempt)),
        ]);
    }

    private function reviewSections(Exam $exam, ExamAttempt $attempt): Collection
    {
        $attempt->load(['sections.adjuster', 'answers']);
        $exam->load([
            'sections.groups.questions.options',
        ]);

        $answersByQuestion = $attempt->answers->keyBy('question_id');

        return $exam->sections->sortBy('position')->values()->map(function ($section) use ($attempt, $answersByQuestion) {
            $attemptSection = $attempt->sections->firstWhere('exam_section_id', $section->id);

            $groups = $section->groups->sortBy('position')->values()->map(function ($group) use ($answersByQuestion) {
                return [
                    'id' => $group->id,
                    'title' => $group->title,
                    'kind' => $group->kind,
                    'position' => $group->position,
                    'stimulus_type' => $group->stimulus_type->value,
                    'stimulus_text' => $group->stimulus_text,
                    'stimulus_media_url' => MediaController::urlFor($group->stimulus_media_path),
                    'questions' => $group->questions->sortBy('position')->values()->map(function ($q) use ($answersByQuestion) {
                        $ans = $answersByQuestion->get($q->id);
                        $isAnswered = $ans !== null && $ans->question_option_id !== null;

                        return [
                            'id' => $q->id,
                            'position' => $q->position,
                            'body' => $q->body,
                            'is_latex' => $q->is_latex,
                            'image_url' => MediaController::urlFor($q->image_path),
                            'options_are_images' => $q->options_are_images,
                            'points' => $q->points,
                            'penalty' => $q->penalty,
                            'is_active' => $q->is_active,
                            'notes' => $q->notes,
                            'options' => $q->options->sortBy('position')->values()->map(fn ($o) => [
                                'id' => $o->id,
                                'position' => $o->position,
                                'label' => $o->label(),
                                'content' => $q->options_are_images ? null : $o->content,
                                'image_url' => $q->options_are_images ? MediaController::urlFor($o->content) : null,
                                'is_correct' => $o->is_correct,
                                'is_selected' => $ans?->question_option_id === $o->id,
                            ]),
                            'answered' => $isAnswered,
                            'selected_option_id' => $ans?->question_option_id,
                            'is_correct' => $ans?->is_correct,
                            'score' => $ans?->score,
                            'answered_at' => $ans?->answered_at?->toIso8601String(),
                        ];
                    }),
                ];
            });

            $totalQuestions = $groups->sum(fn ($g) => $g['questions']->count());
            $answeredCount = $groups->sum(fn ($g) => $g['questions']->where('answered', true)->count());

            return [
                'id' => $section->id,
                'attempt_section_id' => $attemptSection?->id,
                'pillar' => $section->pillar->value,
                'label' => $section->label(),
                'duration_seconds' => $section->duration_seconds,
                'score' => $attemptSection?->score ?? 0,
                'score_web' => $attemptSection?->score_web ?? $attemptSection?->score ?? 0,
                'adjustment_type' => $attemptSection?->adjustment_type,
                'manual_score' => $attemptSection?->manual_score ?? 0,
                'adjustment_notes' => $attemptSection?->adjustment_notes,
                'adjusted_by' => $attemptSection?->adjuster?->name,
                'adjusted_at' => $attemptSection?->adjusted_at?->toIso8601String(),
                'correct_count' => $attemptSection?->correct_count ?? 0,
                'wrong_count' => $attemptSection?->wrong_count ?? 0,
                'answered_count' => $answeredCount,
                'unanswered_count' => $totalQuestions - $answeredCount,
                'total_questions' => $totalQuestions,
                'groups' => $groups,
            ];
        });

    }

    public function adjustSection(
        Request $request,
        Exam $exam,
        ExamAttempt $attempt,
        ExamSection $section,
        ScoringService $scoring
    ): RedirectResponse {
        abort_unless($attempt->exam_id === $exam->id, 404);
        abort_unless($section->exam_id === $exam->id, 404);

        $attemptSection = AttemptSection::where('exam_attempt_id', $attempt->id)
            ->where('exam_section_id', $section->id)
            ->firstOrFail();

        $data = $request->validate([
            'adjustment_type' => ['required', 'in:none,addition,overwrite'],
            'manual_score' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $type = $data['adjustment_type'] === 'none' ? null : $data['adjustment_type'];
        $manualScore = (int) ($data['manual_score'] ?? 0);

        $scoring->adjustSection(
            $attemptSection,
            $type,
            $manualScore,
            $data['notes'] ?? null,
            $request->user()
        );

        return back()->with('success', 'Nilai subtes berhasil diperbarui.');
    }
}
