<?php

namespace App\Models;
use App\Enums\SubmitReason;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttemptSection extends Model
{
    protected $fillable = [
        'exam_attempt_id',
        'exam_section_id',
        'started_at',
        'deadline_at',
        'finished_at',
        'submit_reason',
        'score',
        'score_web',
        'adjustment_type',
        'manual_score',
        'adjustment_notes',
        'adjusted_by',
        'adjusted_at',
        'correct_count',
        'wrong_count',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'finished_at' => 'datetime',
            'submit_reason' => SubmitReason::class,
            'adjusted_at' => 'datetime',
            'score' => 'integer',
            'score_web' => 'integer',
            'manual_score' => 'integer',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(ExamSection::class, 'exam_section_id');
    }

    public function adjuster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }

    public function isFinished(): bool
    {
        return $this->finished_at !== null;
    }

    public function calculateFinalScore(): int
    {
        $base = $this->score_web ?? $this->score ?? 0;

        return match ($this->adjustment_type) {
            'addition' => $base + (int) $this->manual_score,
            'overwrite' => (int) $this->manual_score,
            default => $base,
        };
    }
}
