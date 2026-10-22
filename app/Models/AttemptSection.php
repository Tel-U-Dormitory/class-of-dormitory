<?php

namespace App\Models;

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
        'score',
        'correct_count',
        'wrong_count',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'finished_at' => 'datetime',
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

    public function isFinished(): bool
    {
        return $this->finished_at !== null;
    }
}
