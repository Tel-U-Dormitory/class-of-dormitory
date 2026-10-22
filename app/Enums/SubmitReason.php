<?php

namespace App\Enums;

enum SubmitReason: string
{
    case Manual = 'manual';
    case TimeUp = 'time_up';
    case ForcedByAdmin = 'forced_by_admin';
    case Disqualified = 'disqualified';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Dikirim peserta',
            self::TimeUp => 'Waktu habis',
            self::ForcedByAdmin => 'Dihentikan admin',
            self::Disqualified => 'Didiskualifikasi',
        };
    }
}
