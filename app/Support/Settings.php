<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Pengaturan situs sederhana (key → nilai JSON) dengan cache.
 */
class Settings
{
    private const CACHE_KEY = 'app-settings';

    private const DEFAULTS = [
        'registration_open' => true,
        'registration_closed_message' => 'Pendaftaran sedang ditutup. Pantau pengumuman panitia.',
    ];

    public static function get(string $key): mixed
    {
        $all = Cache::rememberForever(self::CACHE_KEY, fn () => DB::table('settings')->pluck('value', 'key')
            ->map(fn ($v) => json_decode($v, true))
            ->all());

        return array_key_exists($key, $all) ? $all[$key] : (self::DEFAULTS[$key] ?? null);
    }

    public static function set(string $key, mixed $value): void
    {
        DB::table('settings')->updateOrInsert(['key' => $key], ['value' => json_encode($value), 'updated_at' => now(), 'created_at' => now()]);
        Cache::forget(self::CACHE_KEY);
    }

    public static function registrationOpen(): bool
    {
        return (bool) self::get('registration_open');
    }
}
