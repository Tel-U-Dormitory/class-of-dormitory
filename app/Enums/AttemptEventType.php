<?php

namespace App\Enums;

enum AttemptEventType: string
{
    case TabHidden = 'tab_hidden';
    case WindowBlur = 'window_blur';
    case FullscreenExit = 'fullscreen_exit';
    case CopyAttempt = 'copy_attempt';

    public function label(): string
    {
        return match ($this) {
            self::TabHidden => 'Pindah tab',
            self::WindowBlur => 'Jendela kehilangan fokus',
            self::FullscreenExit => 'Keluar layar penuh',
            self::CopyAttempt => 'Mencoba menyalin',
        };
    }
}
