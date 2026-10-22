<?php

namespace App\Enums;

enum ChallengeStatus: string
{
    case Locked = 'locked';
    case Active = 'active';
    case Ended = 'ended';

    public function label(): string
    {
        return match ($this) {
            self::Locked => 'Terkunci',
            self::Active => 'Berlangsung',
            self::Ended => 'Selesai',
        };
    }
}
