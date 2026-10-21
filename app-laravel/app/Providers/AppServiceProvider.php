<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Peserta sering berbagi satu IP publik (Wi-Fi kampus/asrama), jadi batas dihitung per peserta,
        // bukan per IP. Throttle bawaan hanya mengenali guard "web" dan akan jatuh ke IP.
        $perParticipant = fn (int $perMinute) => fn (Request $request) => Limit::perMinute($perMinute)
            ->by('p:'.($request->user('participant')?->getAuthIdentifier() ?? $request->ip()));

        RateLimiter::for('exam-answer', $perParticipant(120));
        RateLimiter::for('exam-event', $perParticipant(60));
        RateLimiter::for('exam-heartbeat', $perParticipant(30));

        // Pendaftaran massal dari satu jaringan tetap dibatasi, tapi longgar.
        RateLimiter::for('registration', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));
    }
}
