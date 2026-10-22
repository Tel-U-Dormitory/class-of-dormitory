<?php

namespace App\Enums;

enum CompetitionMode: string
{
    case Individual = 'individual';
    case Team = 'team';

    public function label(): string
    {
        return match ($this) {
            self::Individual => 'Individu',
            self::Team => 'Kelompok',
        };
    }
}
