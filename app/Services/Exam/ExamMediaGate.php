<?php

namespace App\Services\Exam;

use App\Enums\AttemptStatus;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\QuestionGroup;
use Illuminate\Support\Facades\Log;

/**
 * Menentukan apakah peserta boleh mengunduh media tertentu saat ini.
 */
class ExamMediaGate
{
    public function canViewStimulus(ExamAttempt $attempt, QuestionGroup $group): bool
    {
        if (! $this->groupIsCurrent($attempt, $group)) {
            return $this->deny($attempt, $group, 'attempt_or_section_mismatch');
        }

        // Toleransi kecil agar gambar yang sedang dimuat saat waktu hampir habis tetap terkirim.
        $allowed = $attempt->observations()
            ->where('question_group_id', $group->id)
            ->where('ends_at', '>', now()->subSeconds(2))
            ->exists();

        return $allowed ?: $this->deny($attempt, $group, 'observation_not_active');
    }

    public function canViewQuestion(ExamAttempt $attempt, Question $question): bool
    {
        $group = $question->group;

        if (! $question->is_active || ! $this->groupIsCurrent($attempt, $group)) {
            return $this->deny($attempt, $group, ! $question->is_active ? 'question_inactive' : 'attempt_or_section_mismatch', $question->id);
        }

        if (! $group->requiresObservation()) {
            return true;
        }

        $allowed = $attempt->observations()
            ->where('question_group_id', $group->id)
            ->where('ends_at', '<=', now())
            ->exists();

        return $allowed ?: $this->deny($attempt, $group, 'observation_not_finished', $question->id);
    }

    private function deny(ExamAttempt $attempt, QuestionGroup $group, string $reason, ?int $questionId = null): bool
    {
        Log::notice('exam_media_denied', [
            'reason' => $reason, 'attempt_id' => $attempt->id,
            'section_id' => $attempt->current_section_id, 'group_id' => $group->id,
            'question_id' => $questionId,
        ]);

        return false;
    }

    private function groupIsCurrent(ExamAttempt $attempt, QuestionGroup $group): bool
    {
        return $attempt->status === AttemptStatus::InProgress
            && $group->exam_section_id === $attempt->current_section_id;
    }
}
