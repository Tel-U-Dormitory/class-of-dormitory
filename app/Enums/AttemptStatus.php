<?php

namespace App\Enums;

enum AttemptStatus: string
{
    case InProgress = 'in_progress';
    case OnBreak = 'on_break';
    case Submitted = 'submitted';

    public function label(): string
    {
        return match ($this) {
            self::InProgress => 'Mengerjakan',
            self::OnBreak => 'Jeda',
            self::Submitted => 'Selesai',
        };
    }

    public function isActive(): bool
    {
        return $this !== self::Submitted;
    }
}
