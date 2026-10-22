<?php

namespace App\Services\Exam;

use App\Enums\AttemptStatus;
use App\Enums\ParticipantStatus;
use App\Enums\SubmitReason;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Aturan cast: N peringkat teratas global di-keep (lolos langsung), lalu tiap gedung
 * mengambil M besar dari sisa peserta gedung tersebut.
 * Peringkat: skor total tertinggi, lalu durasi pengerjaan tersingkat.
 */
class CastSelectionService
{
    public function globalKeep(): int
    {
        return (int) config('exam.cast.global_keep');
    }

    public function perBuilding(): int
    {
        return (int) config('exam.cast.per_building');
    }

    /**
     * @return Collection<int, ExamAttempt>
     */
    public function ranked(Exam $exam): Collection
    {
        return ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->where('status', AttemptStatus::Submitted)
            ->where(fn ($q) => $q->whereNull('submit_reason')->orWhere('submit_reason', '!=', SubmitReason::Disqualified))
            ->whereHas('participant', fn ($q) => $q->where('status', '!=', ParticipantStatus::Disqualified))
            ->with(['participant.building', 'sections'])
            ->orderByDesc('score_total')
            ->orderBy('duration_seconds')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return array{global: Collection<int, ExamAttempt>, buildings: Collection<int, Collection<int, ExamAttempt>>}
     */
    public function select(Exam $exam): array
    {
        $ranked = $this->ranked($exam);
        $global = $ranked->take($this->globalKeep())->values();
        $rest = $ranked->slice($this->globalKeep());

        $buildings = $rest
            ->groupBy(fn (ExamAttempt $a) => $a->participant->building_id)
            ->map(fn (Collection $list) => $list->take($this->perBuilding())->values());

        return ['global' => $global, 'buildings' => $buildings];
    }

    /**
     * Menetapkan cast ke database: menandai attempt dan mengubah status peserta.
     * Peserta yang sebelumnya cast tetapi kini tidak terpilih dikembalikan ke "sudah ujian".
     */
    public function apply(Exam $exam): int
    {
        return DB::transaction(function () use ($exam) {
            ['global' => $global, 'buildings' => $buildings] = $this->select($exam);

            $previous = ExamAttempt::where('exam_id', $exam->id)->whereNotNull('cast_type')->pluck('participant_id');
            ExamAttempt::where('exam_id', $exam->id)->update(['cast_type' => null]);

            ExamAttempt::whereIn('id', $global->pluck('id'))->update(['cast_type' => 'global']);
            $buildingIds = $buildings->flatten(1)->pluck('id');
            ExamAttempt::whereIn('id', $buildingIds)->update(['cast_type' => 'building']);

            $selected = $global->pluck('participant_id')->concat($buildings->flatten(1)->pluck('participant_id'));

            Participant::whereIn('id', $previous->diff($selected))
                ->where('status', ParticipantStatus::CastSelected)
                ->update(['status' => ParticipantStatus::Submitted]);

            Participant::whereIn('id', $selected)
                ->whereIn('status', [ParticipantStatus::Submitted, ParticipantStatus::Registered])
                ->update(['status' => ParticipantStatus::CastSelected]);

            return $selected->count();
        });
    }
}
