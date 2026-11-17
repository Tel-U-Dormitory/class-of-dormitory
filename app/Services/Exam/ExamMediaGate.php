<?php

namespace App\Services\Exam;

use App\Enums\AttemptStatus;
use App\Enums\StimulusType;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

class ExamMediaGate
{
    public function canViewStimulus(object $media): bool
    {
        if (! $this->groupIsCurrent($media)) {
            return $this->deny($media, 'attempt_or_section_mismatch');
        }

        // Preserve the two-second tolerance for a download at observation end.
        $allowed = $media->observation_ends_at !== null
            && CarbonImmutable::parse($media->observation_ends_at)->gt(now()->subSeconds(2));

        return $allowed ?: $this->deny($media, 'observation_not_active');
    }

    public function canViewQuestion(object $media): bool
    {
        if (! $media->is_active || ! $this->groupIsCurrent($media)) {
            return $this->deny($media, ! $media->is_active ? 'question_inactive' : 'attempt_or_section_mismatch');
        }

        if (! StimulusType::from($media->stimulus_type)->requiresObservation()) {
            return true;
        }

        $allowed = $media->observation_ends_at !== null
            && CarbonImmutable::parse($media->observation_ends_at)->lte(now());

        return $allowed ?: $this->deny($media, 'observation_not_finished');
    }

    private function groupIsCurrent(object $media): bool
    {
        return $media->status === AttemptStatus::InProgress->value
            && (int) $media->exam_section_id === (int) $media->current_section_id;
    }

    private function deny(object $media, string $reason): bool
    {
        Log::notice('exam_media_denied', [
            'reason' => $reason, 'attempt_id' => $media->attempt_id,
            'section_id' => $media->current_section_id, 'group_id' => $media->group_id,
            'question_id' => $media->question_id ?? null,
        ]);

        return false;
    }
}
