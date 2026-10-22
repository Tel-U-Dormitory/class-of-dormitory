<?php

namespace App\Enums;

enum ExamStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Open => 'Dibuka',
            self::Closed => 'Ditutup',
        };
    }
}
