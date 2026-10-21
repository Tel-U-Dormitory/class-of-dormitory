<?php

namespace App\Enums;

enum Pillar: string
{
    case Memory = 'memory';
    case Spatial = 'spatial';
    case Numeric = 'numeric';
    case Logic = 'logic';

    public function label(): string
    {
        return match ($this) {
            self::Memory => 'Memory',
            self::Spatial => 'Spatial',
            self::Numeric => 'Numeric',
            self::Logic => 'Logic',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Memory => 'Daya ingat visual dan verbal: denah, kartu identitas, teks aturan, urutan, dan kilasan gambar.',
            self::Spatial => 'Visualisasi ruang: jaring-jaring, rotasi, irisan, tumpukan, dan menghitung balok.',
            self::Numeric => 'Penalaran angka: deret, matriks, operator kustom, perbandingan kuantitatif, dan hitung cepat.',
            self::Logic => 'Penalaran logis: silogisme, posisi duduk, jujur-bohong, diagram alur, dan sandi.',
        };
    }
}
