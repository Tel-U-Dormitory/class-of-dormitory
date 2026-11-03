<?php

namespace App\Enums;

/**
 * Materi observasi yang ditampilkan sekali sebelum soal dalam satu grup bisa dikerjakan.
 */
enum StimulusType: string
{
    case None = 'none';
    case Text = 'text';
    case Image = 'image';
    case Video = 'video';
    case Flash = 'flash';

    public function label(): string
    {
        return match ($this) {
            self::None => 'Tanpa observasi',
            self::Text => 'Teks',
            self::Image => 'Gambar',
            self::Video => 'Video',
            self::Flash => 'Kilasan gambar (flash)',
        };
    }

    public function requiresObservation(): bool
    {
        return $this !== self::None;
    }
}
