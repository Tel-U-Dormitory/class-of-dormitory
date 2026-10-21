<?php

namespace App\Models;

use App\Enums\AttemptEventType;
use Illuminate\Database\Eloquent\Model;

class AttemptEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['exam_attempt_id', 'type', 'meta'];

    protected function casts(): array
    {
        return [
            'type' => AttemptEventType::class,
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
