<?php

return [
    /*
    | Toleransi (detik) setelah tenggat pilar di mana jawaban masih diterima,
    | untuk menutupi latensi jaringan saat timer peserta menyentuh nol.
    */
    'grace_seconds' => (int) env('EXAM_GRACE_SECONDS', 3),

    // Jendela (detik, dihitung dari tenggat) di mana jawaban pilar yang habis waktu masih diterima.
    'late_submit_seconds' => (int) env('EXAM_LATE_SUBMIT_SECONDS', 300),

    // Toleransi selisih jam klien saat memeriksa cap waktu jawaban terlambat.
    'late_skew_seconds' => (int) env('EXAM_LATE_SKEW_SECONDS', 5),

    // Batas jumlah jawaban per request.
    'max_answers_per_sync' => 500,

    // Interval (detik) polling monitor admin.
    'monitor_poll_seconds' => 5,

    'default_section_seconds' => 30 * 60,

    'default_break_seconds' => 5 * 60,

    /*
    | Penetapan cast setelah ujian seleksi: N teratas global di-keep,
    | lalu M besar per gedung dari peserta sisanya.
    */
    'cast' => [
        'global_keep' => 4,
        'per_building' => 4,
    ],
];
