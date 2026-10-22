<?php

namespace App\Models;

use App\Enums\Pillar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class ExamSection extends Model
{
    protected $fillable = ['exam_id', 'pillar', 'position', 'duration_seconds', 'instructions'];

    protected function casts(): array
    {
        return [
            'pillar' => Pillar::class,
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(QuestionGroup::class)->orderBy('position')->orderBy('id');
    }

    public function questions(): HasManyThrough
    {
        return $this->hasManyThrough(Question::class, QuestionGroup::class);
    }

    public function label(): string
    {
        return $this->pillar->label();
    }
}
