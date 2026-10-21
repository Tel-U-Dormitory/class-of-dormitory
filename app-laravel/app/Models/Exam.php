<?php

namespace App\Models;

use App\Enums\ExamStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Exam extends Model
{
    /** @use HasFactory<\Database\Factories\ExamFactory> */
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'status',
        'scheduled_at',
        'break_seconds',
        'announcement',
        'results_published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ExamStatus::class,
            'scheduled_at' => 'datetime',
            'results_published_at' => 'datetime',
        ];
    }

    public function sections(): HasMany
    {
        return $this->hasMany(ExamSection::class)->orderBy('position');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function questionGroups(): HasManyThrough
    {
        return $this->hasManyThrough(QuestionGroup::class, ExamSection::class);
    }

    public function scopeOpen(Builder $query): void
    {
        $query->where('status', ExamStatus::Open);
    }

    public function isOpen(): bool
    {
        return $this->status === ExamStatus::Open;
    }

    public function totalDurationSeconds(): int
    {
        return (int) $this->sections->sum('duration_seconds');
    }
}
