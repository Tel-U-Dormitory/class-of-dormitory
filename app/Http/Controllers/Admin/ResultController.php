<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Pillar;
use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Services\Exam\CastSelectionService;
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

        // Pratinjau aturan cast agar panitia bisa memeriksa sebelum menetapkan.
        ['global' => $global, 'buildings' => $buildings] = $this->cast->select($exam);
        $preview = $global->mapWithKeys(fn ($a) => [$a->id => 'global'])
            ->union($buildings->flatten(1)->mapWithKeys(fn ($a) => [$a->id => 'building']));

        $rows = $this->ranked($exam)->map(fn (array $row) => [...$row, 'cast_preview' => $preview->get($row['attempt_id'])]);

        return Inertia::render('admin/exams/results', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'results_published' => $exam->results_published_at !== null,
                'cast_applied' => ExamAttempt::where('exam_id', $exam->id)->whereNotNull('cast_type')->exists(),
                'sections' => $exam->sections->map(fn ($s) => ['id' => $s->id, 'label' => $s->label()]),
            ],
            'rows' => $building ? $rows->where('building_id', $building)->values() : $rows,
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'filters' => ['building' => $building],
            'castRules' => ['global_keep' => $this->cast->globalKeep(), 'per_building' => $this->cast->perBuilding()],
            'pillars' => collect(Pillar::cases())->map(fn ($p) => ['value' => $p->value, 'label' => $p->label()]),
        ]);
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
    private function ranked(Exam $exam): Collection
    {
        $rows = $this->cast->ranked($exam)
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
}
