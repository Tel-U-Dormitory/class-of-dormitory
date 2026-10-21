<?php

namespace App\Enums;

enum GameType: string
{
    case NumericalOdyssey = 'numerical_odyssey';
    case NumericKeypad = 'numeric_keypad';
    case TextCode = 'text_code';
    case Choice = 'choice';

    public function label(): string
    {
        return match ($this) {
            self::NumericalOdyssey => 'Numerical Odyssey (rumus angka 1–6)',
            self::NumericKeypad => 'Keypad angka',
            self::TextCode => 'Sandi teks',
            self::Choice => 'Pilihan ganda A–D',
        };
    }

    public function answerHint(): string
    {
        return match ($this) {
            self::NumericalOdyssey => 'Angka target yang harus dihasilkan rumus, misalnya 24.',
            self::NumericKeypad => 'Jawaban angka atau kode digit.',
            self::TextCode => 'Kata/kalimat sandi. Huruf besar-kecil dan spasi di tepi diabaikan.',
            self::Choice => 'Salah satu huruf A, B, C, atau D.',
        };
    }

    /** Numerical Odyssey boleh dicoba berkali-kali sampai benar; game lain sekali kirim. */
    public function defaultMaxAttempts(): ?int
    {
        return $this === self::NumericalOdyssey ? null : 1;
    }
}
