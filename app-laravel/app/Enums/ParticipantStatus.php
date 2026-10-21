<?php

namespace App\Enums;

enum ParticipantStatus: string
{
    case Registered = 'registered';
    case InExam = 'in_exam';
    case Submitted = 'submitted';
    case CastSelected = 'cast_selected';
    case Advanced = 'advanced';
    case Deathmatch = 'deathmatch';
    case Eliminated = 'eliminated';
    case Disqualified = 'disqualified';

    public function label(): string
    {
        return match ($this) {
            self::Registered => 'Terdaftar',
            self::InExam => 'Sedang ujian',
            self::Submitted => 'Sudah ujian',
            self::CastSelected => 'Cast',
            self::Advanced => 'Lolos babak',
            self::Deathmatch => 'Deathmatch',
            self::Eliminated => 'Tereliminasi',
            self::Disqualified => 'Didiskualifikasi',
        };
    }

    /**
     * Status peserta yang masih bertanding di babak challenge.
     *
     * @return list<self>
     */
    public static function competing(): array
    {
        return [self::CastSelected, self::Advanced, self::Deathmatch];
    }
}
