<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttemptObservation extends Model
{
    protected $fillable = ['exam_attempt_id', 'question_group_id', 'started_at', 'ends_at'];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(QuestionGroup::class, 'question_group_id');
    }

    public function isActive(?CarbonInterface $now = null): bool
    {
        return ($now ?? now())->lt($this->ends_at);
    }
}
