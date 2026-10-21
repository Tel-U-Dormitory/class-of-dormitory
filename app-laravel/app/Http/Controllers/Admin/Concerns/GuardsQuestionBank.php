<?php

namespace App\Http\Controllers\Admin\Concerns;

use App\Models\Exam;
use Illuminate\Http\Exceptions\HttpResponseException;

trait GuardsQuestionBank
{
    protected function ensureQuestionBankEditable(Exam $exam): void
    {
        if ($exam->questionBankLocked()) {
            throw new HttpResponseException(
                back()->with('error', 'Bank soal terkunci karena ujian sedang dibuka atau masih ada peserta yang mengerjakan. Tutup ujian dan tunggu semua peserta selesai.'),
            );
        }
    }
}
