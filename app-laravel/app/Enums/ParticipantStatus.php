<?php

namespace App\Enums;

enum ParticipantStatus: string
{
    case Registered = 'registered';
    case InExam = 'in_exam';
    case Submitted = 'submitted';
    case CastSelected = 'cast_selected';
    case Eliminated = 'eliminated';
    case Disqualified = 'disqualified';

    public function label(): string
    {
        return match ($this) {
            self::Registered => 'Terdaftar',
            self::InExam => 'Sedang ujian',
            self::Submitted => 'Sudah ujian',
            self::CastSelected => 'Lolos (Cast)',
            self::Eliminated => 'Tereliminasi',
            self::Disqualified => 'Didiskualifikasi',
        };
    }
}
