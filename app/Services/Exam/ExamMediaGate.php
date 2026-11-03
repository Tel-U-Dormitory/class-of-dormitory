<?php

namespace App\Services\Exam;

use App\Enums\AttemptStatus;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\QuestionGroup;

/**
 * Menentukan apakah peserta boleh mengunduh media tertentu saat ini.
 */
class ExamMediaGate
{
    public function canViewStimulus(ExamAttempt $attempt, QuestionGroup $group): bool
    {
        if (! $this->groupIsCurrent($attempt, $group)) {
            return false;
        }

        // Toleransi kecil agar gambar yang sedang dimuat saat waktu hampir habis tetap terkirim.
        return $attempt->observations()
            ->where('question_group_id', $group->id)
            ->where('ends_at', '>', now()->subSeconds(2))
            ->exists();
    }

    public function canViewQuestion(ExamAttempt $attempt, Question $question): bool
    {
        $group = $question->group;

        if (! $question->is_active || ! $this->groupIsCurrent($attempt, $group)) {
            return false;
        }

        if (! $group->requiresObservation()) {
            return true;
        }

        return $attempt->observations()
            ->where('question_group_id', $group->id)
            ->where('ends_at', '<=', now())
            ->exists();
    }

    private function groupIsCurrent(ExamAttempt $attempt, QuestionGroup $group): bool
    {
        return $attempt->status === AttemptStatus::InProgress
            && $group->exam_section_id === $attempt->current_section_id;
    }
}
