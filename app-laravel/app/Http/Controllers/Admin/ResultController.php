<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AttemptStatus;
use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultController extends Controller
{
    public function index(Request $request, Exam $exam): Response
    {
        $exam->load('sections');
        $building = $request->integer('building') ?: null;

        $rows = $this->ranked($exam);

        return Inertia::render('admin/exams/results', [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'results_published' => $exam->results_published_at !== null,
                'sections' => $exam->sections->map(fn ($s) => ['id' => $s->id, 'label' => $s->label()]),
            ],
            'rows' => $building ? $rows->where('building_id', $building)->values() : $rows,
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'filters' => ['building' => $building],
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

    /**
     * Urutan: skor total tertinggi, lalu durasi pengerjaan tersingkat.
     */
    private function ranked(Exam $exam): Collection
    {
        $rows = ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->where('status', AttemptStatus::Submitted)
            ->with(['participant:id,full_name,nim,major,building_id', 'participant.building:id,name', 'sections'])
            ->orderByDesc('score_total')
            ->orderBy('duration_seconds')
            ->get()
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
            ]);

        $buildingCounters = [];

        return $rows->map(function (array $row) use (&$buildingCounters) {
            $buildingCounters[$row['building_id']] = ($buildingCounters[$row['building_id']] ?? 0) + 1;

            return [...$row, 'building_rank' => $buildingCounters[$row['building_id']]];
        });
    }
}
