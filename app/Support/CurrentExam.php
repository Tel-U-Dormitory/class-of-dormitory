<?php

namespace App\Support;

use App\Enums\ExamStatus;
use App\Models\Exam;

/**
 * Ujian yang ditampilkan ke peserta: ujian yang sedang dibuka,
 * atau jika tidak ada, ujian terbaru yang sudah dijadwalkan/ditutup.
 */
class CurrentExam
{
    public static function get(): ?Exam
    {
        return Exam::open()->latest('id')->first()
            ?? Exam::where('status', '!=', ExamStatus::Draft)->latest('id')->first();
    }
}
