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
use Illuminate\Http\JsonResponse;
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

    public function index(Request $request, Exam $exam): Response|JsonResponse
    {
        if ($request->filled('batch_page')) {
            return $this->batchResults($request, $exam);
        }

        $exam->load('sections');
        $building = $request->integer('building') ?: null;
        $isAdmin = $request->user()?->isAdmin() === true;
        $sectionId = $isAdmin ? ($request->integer('section') ?: null) : null;
        if ($sectionId !== null && ! $exam->sections->contains('id', $sectionId)) {
            $sectionId = null;
        }

        return Inertia::render('admin/exams/results', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'results_published' => $exam->results_published_at !== null,
                'cast_applied' => ExamAttempt::where('exam_id', $exam->id)->whereNotNull('cast_type')->exists(),
                'sections' => $exam->sections->map(fn ($s) => [
                    'id' => $s->id,
                    'pillar' => $s->pillar->value,
                    'position' => $s->position,
                    'label' => $s->label(),
                ]),
            ],
            'results' => Inertia::defer(fn () => $this->resultsPage($request, $exam, $building, $sectionId)),
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'filters' => array_filter([
                'building' => $building,
                'section' => $sectionId,
            ], fn ($v) => $v !== null || true),
            'castRules' => ['global_keep' => $this->cast->globalKeep(), 'per_building' => $this->cast->perBuilding()],
            'pillars' => collect(Pillar::cases())->map(fn ($p) => ['value' => $p->value, 'label' => $p->label()]),
        ]);
    }

    private function resultsPage(Request $request, Exam $exam, ?int $building, ?int $sectionId = null): array
    {
        $isAdmin = $request->user()?->isAdmin() === true;
        // Cast and ranks must use the entire cohort, before filtering or pagination.
        $ranked = $this->cast->ranked($exam);
        if ($isAdmin) {
            $ranked->loadMissing('sections');
        }

        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam, $ranked);
        $preview = $global->mapWithKeys(fn ($a) => [$a->id => 'global'])
            ->union($buildings->flatten(1)->mapWithKeys(fn ($a) => [$a->id => 'building']));
        $buildingCounters = [];
        $ranks = $ranked->values()->mapWithKeys(function ($attempt, $index) use (&$buildingCounters) {
            $id = $attempt->participant->building_id;
            $buildingCounters[$id] = ($buildingCounters[$id] ?? 0) + 1;

            return [$attempt->id => ['rank' => $index + 1, 'building_rank' => $buildingCounters[$id]]];
        });

        $subtestRanks = $isAdmin ? $this->computeSubtestRanks($exam, $ranked) : [];
        $signature = $this->resultsSignature($exam, $ranked);

        $orderedCohort = ($isAdmin && $sectionId !== null)
            ? $this->sortCohortBySection($ranked, $sectionId)
            : $ranked;

        $filtered = $building ? $orderedCohort->filter(fn ($a) => $a->participant->building_id === $building)->values() : $orderedCohort;
        $lastPage = max(1, (int) ceil($filtered->count() / 50));
        $page = min(max(1, $request->integer('page', 1)), $lastPage);
        $rows = $this->ranked($exam, $filtered->forPage($page, 50), $isAdmin, $subtestRanks)->map(fn ($row) => [
            ...$row,
            ...$ranks[$row['attempt_id']],
            'cast_preview' => $preview->get($row['attempt_id']),
        ]);

        return [
            'rows' => $rows,
            'page' => $page,
            'last_page' => $lastPage,
            'total' => $filtered->count(),
            'cohort_total' => $ranked->count(),
            'signature' => $signature,
        ];
    }

    private function batchResults(Request $request, Exam $exam): JsonResponse
    {
        $isAdmin = $request->user()?->isAdmin() === true;
        $page = max(1, $request->integer('batch_page', 1));
        $perPage = min(500, max(25, $request->integer('batch_size', 200)));

        $ranked = $this->cast->ranked($exam);
        if ($isAdmin) {
            $ranked->loadMissing('sections');
        }

        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam, $ranked);
        $preview = $global->mapWithKeys(fn ($a) => [$a->id => 'global'])
            ->union($buildings->flatten(1)->mapWithKeys(fn ($a) => [$a->id => 'building']));
        $buildingCounters = [];
        $ranks = $ranked->values()->mapWithKeys(function ($attempt, $index) use (&$buildingCounters) {
            $id = $attempt->participant->building_id;
            $buildingCounters[$id] = ($buildingCounters[$id] ?? 0) + 1;

            return [$attempt->id => ['rank' => $index + 1, 'building_rank' => $buildingCounters[$id]]];
        });

        $subtestRanks = $isAdmin ? $this->computeSubtestRanks($exam, $ranked) : [];

        $total = $ranked->count();
        $rows = $this->ranked($exam, $ranked->forPage($page, $perPage), $isAdmin, $subtestRanks)->map(fn ($row) => [
            ...$row,
            ...$ranks[$row['attempt_id']],
            'cast_preview' => $preview->get($row['attempt_id']),
        ])->values();

        return response()->json([
            'rows' => $rows,
            'page' => $page,
            'has_more' => ($page * $perPage) < $total,
            'total' => $total,
        ]);
    }

    private function resultsSignature(Exam $exam, Collection $ranked): string
    {
        $count = $ranked->count();
        $scoreSum = (int) $ranked->sum('score_total');
        $maxAttemptUpdated = $ranked->max(fn (ExamAttempt $a) => $a->updated_at?->getTimestamp() ?? 0) ?? 0;
        $maxSectionAdjusted = AttemptSection::query()
            ->whereIn('exam_attempt_id', $ranked->pluck('id'))
            ->max('updated_at') ?? '';

        return "{$exam->id}:{$count}:{$scoreSum}:{$maxAttemptUpdated}:{$maxSectionAdjusted}";
    }

    public function export(Request $request, Exam $exam): StreamedResponse
    {
        $exam->load('sections');
        $isAdmin = $request->user()?->isAdmin() === true;
        $sectionId = $isAdmin ? ($request->integer('section') ?: null) : null;
        $activeSection = $sectionId ? $exam->sections->firstWhere('id', $sectionId) : null;

        $ranked = $this->cast->ranked($exam);
        $ranked->loadMissing('sections');

        if ($activeSection) {
            $subtestRanks = $this->computeSubtestRanks($exam, $ranked);
            $ordered = $this->sortCohortBySection($ranked, $activeSection->id);
            $rows = $this->ranked($exam, $ordered, true, $subtestRanks);
            $filename = 'hasil-'.str($exam->title)->slug().'-'.str($activeSection->label())->slug().'.csv';

            return response()->streamDownload(function () use ($rows, $exam, $activeSection) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF");
                fputcsv($out, [
                    "Peringkat {$activeSection->label()}",
                    "Peringkat Gedung {$activeSection->label()}",
                    'Peringkat Total',
                    'Nama',
                    'NIM',
                    'Gedung',
                    'Prodi',
                    "Skor {$activeSection->label()}",
                    "Benar {$activeSection->label()}",
                    "Salah {$activeSection->label()}",
                    "Durasi {$activeSection->label()} (detik)",
                    ...$exam->sections->map->label(),
                    'Total Skor',
                    'Durasi Total (detik)',
                    'Pindah Tab',
                    'Keterangan',
                ]);

                foreach ($rows as $row) {
                    $secRank = $row['section_ranks'][$activeSection->id] ?? null;
                    fputcsv($out, [
                        $secRank['rank'] ?? $row['rank'],
                        $secRank['building_rank'] ?? $row['building_rank'],
                        $row['rank'],
                        $row['full_name'],
                        $row['nim'],
                        $row['building'],
                        $row['major'],
                        $secRank['score'] ?? ($row['section_scores'][$activeSection->id] ?? 0),
                        $secRank['correct_count'] ?? 0,
                        $secRank['wrong_count'] ?? 0,
                        $secRank['duration_seconds'] ?? 0,
                        ...$exam->sections->map(fn ($s) => $row['section_scores'][$s->id] ?? 0),
                        $row['score_total'],
                        $row['duration_seconds'],
                        $row['tab_switch_count'],
                        $row['submit_reason'],
                    ]);
                }

                fclose($out);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $rows = $this->ranked($exam, $ranked);

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
    private function ranked(Exam $exam, ?Collection $ranked = null, bool $includeSubtestRanks = false, array $subtestRanks = []): Collection
    {
        $ranked ??= $this->cast->ranked($exam);
        $ranked->loadMissing('sections');

        $rows = $ranked
            ->values()
            ->map(function (ExamAttempt $a, int $i) use ($includeSubtestRanks, $subtestRanks) {
                $row = [
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
                ];

                if ($includeSubtestRanks) {
                    $row['section_ranks'] = $subtestRanks[$a->id] ?? [];
                }

                return $row;
            });

        $buildingCounters = [];

        return $rows->map(function (array $row) use (&$buildingCounters) {
            $buildingCounters[$row['building_id']] = ($buildingCounters[$row['building_id']] ?? 0) + 1;

            return [...$row, 'building_rank' => $buildingCounters[$row['building_id']]];
        });
    }

    private function sectionDurationSeconds(?AttemptSection $attemptSection, ?ExamSection $examSection = null): int
    {
        if ($attemptSection && $attemptSection->started_at && $attemptSection->finished_at) {
            return max(0, (int) $attemptSection->started_at->diffInSeconds($attemptSection->finished_at));
        }

        return (int) ($examSection?->duration_seconds ?? 0);
    }

    /**
     * Mengurutkan cohort peserta berdasarkan aturan peringkat per subtes:
     * 1. Skor subtes tertinggi (DESC)
     * 2. Durasi pengerjaan subtes tersingkat (ASC)
     * 3. Skor total tertinggi (DESC)
     * 4. Durasi total tersingkat (ASC)
     * 5. ID attempt terkecil (ASC)
     *
     * @param  Collection<int, ExamAttempt>  $cohort
     * @return Collection<int, ExamAttempt>
     */
    private function sortCohortBySection(Collection $cohort, int $sectionId, ?ExamSection $examSection = null): Collection
    {
        return $cohort->sort(function (ExamAttempt $a, ExamAttempt $b) use ($sectionId, $examSection) {
            $secA = $a->sections->firstWhere('exam_section_id', $sectionId);
            $secB = $b->sections->firstWhere('exam_section_id', $sectionId);

            $scoreA = (int) ($secA?->score ?? 0);
            $scoreB = (int) ($secB?->score ?? 0);
            if ($scoreA !== $scoreB) {
                return $scoreB <=> $scoreA;
            }

            $durA = $this->sectionDurationSeconds($secA, $examSection);
            $durB = $this->sectionDurationSeconds($secB, $examSection);
            if ($durA !== $durB) {
                return $durA <=> $durB;
            }

            $totalA = (int) ($a->score_total ?? 0);
            $totalB = (int) ($b->score_total ?? 0);
            if ($totalA !== $totalB) {
                return $totalB <=> $totalA;
            }

            $totalDurA = (int) ($a->duration_seconds ?? PHP_INT_MAX);
            $totalDurB = (int) ($b->duration_seconds ?? PHP_INT_MAX);
            if ($totalDurA !== $totalDurB) {
                return $totalDurA <=> $totalDurB;
            }

            return $a->id <=> $b->id;
        })->values();
    }

    /**
     * Menghitung peringkat global & gedung untuk setiap subtes pada seluruh cohort.
     *
     * @param  Collection<int, ExamAttempt>  $ranked
     * @return array<int, array<int, array{rank: int, building_rank: int, score: int, correct_count: int, wrong_count: int, duration_seconds: int}>>
     */
    private function computeSubtestRanks(Exam $exam, Collection $ranked): array
    {
        $exam->loadMissing('sections');
        $byAttempt = [];

        foreach ($exam->sections as $section) {
            $sorted = $this->sortCohortBySection($ranked, $section->id, $section);
            $buildingCounters = [];

            foreach ($sorted as $index => $attempt) {
                $bId = $attempt->participant->building_id;
                $buildingCounters[$bId] = ($buildingCounters[$bId] ?? 0) + 1;
                $attemptSec = $attempt->sections->firstWhere('exam_section_id', $section->id);

                $byAttempt[$attempt->id][$section->id] = [
                    'rank' => $index + 1,
                    'building_rank' => $buildingCounters[$bId],
                    'score' => (int) ($attemptSec?->score ?? 0),
                    'correct_count' => (int) ($attemptSec?->correct_count ?? 0),
                    'wrong_count' => (int) ($attemptSec?->wrong_count ?? 0),
                    'duration_seconds' => $this->sectionDurationSeconds($attemptSec, $section),
                ];
            }
        }

        return $byAttempt;
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
