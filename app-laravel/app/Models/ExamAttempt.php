<?php

namespace App\Models;

use App\Enums\AttemptStatus;
use App\Enums\SubmitReason;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    protected $fillable = [
        'exam_id',
        'participant_id',
        'status',
        'current_section_id',
        'started_at',
        'break_ends_at',
        'submitted_at',
        'submit_reason',
        'tab_switch_count',
        'last_seen_at',
        'score_total',
        'correct_count',
        'wrong_count',
        'duration_seconds',
        'cast_type',
        'specialist_pillar',
    ];

    protected function casts(): array
    {
        return [
            'status' => AttemptStatus::class,
            'submit_reason' => SubmitReason::class,
            'started_at' => 'datetime',
            'break_ends_at' => 'datetime',
            'submitted_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'specialist_pillar' => \App\Enums\Pillar::class,
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function currentSection(): BelongsTo
    {
        return $this->belongsTo(ExamSection::class, 'current_section_id');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(AttemptSection::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class);
    }

    public function observations(): HasMany
    {
        return $this->hasMany(AttemptObservation::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(AttemptEvent::class);
    }

    public function isSubmitted(): bool
    {
        return $this->status === AttemptStatus::Submitted;
    }

    public function currentAttemptSection(): ?AttemptSection
    {
        if (! $this->current_section_id) {
            return null;
        }

        return $this->sections->firstWhere('exam_section_id', $this->current_section_id);
    }
}
