<?php

namespace App\Models;

use App\Enums\StimulusType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuestionGroup extends Model
{
    protected $fillable = [
        'exam_section_id',
        'title',
        'kind',
        'position',
        'stimulus_type',
        'stimulus_text',
        'stimulus_media_path',
        'stimulus_slides',
        'stimulus_duration_seconds',
    ];

    protected function casts(): array
    {
        return [
            'stimulus_type' => StimulusType::class,
            'stimulus_slides' => 'array',
        ];
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(ExamSection::class, 'exam_section_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('position')->orderBy('id');
    }

    public function requiresObservation(): bool
    {
        return $this->stimulus_type->requiresObservation();
    }

    /**
     * Lama observasi dalam detik. Untuk flash, jumlah durasi seluruh slide.
     */
    public function observationSeconds(): int
    {
        if ($this->stimulus_type === StimulusType::Flash) {
            return (int) collect($this->stimulus_slides ?? [])->sum('duration');
        }

        return (int) ($this->stimulus_duration_seconds ?? 0);
    }
}
