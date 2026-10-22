<?php

namespace App\Http\Controllers\Exam\Concerns;

use App\Models\ExamAttempt;
use App\Support\CurrentExam;
use Illuminate\Http\Request;

trait ResolvesAttempt
{
    /**
     * Attempt milik peserta yang login pada ujian aktif. 404 jika belum mulai.
     */
    protected function attempt(Request $request): ExamAttempt
    {
        $exam = CurrentExam::get();
        abort_unless($exam, 404);

        return ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->where('participant_id', $request->user('participant')->id)
            ->firstOrFail();
    }
}
