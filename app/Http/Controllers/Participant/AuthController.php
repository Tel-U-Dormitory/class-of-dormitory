<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Participant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('participant/login');
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'nim' => ['required', 'string', 'max:32'],
            'token' => ['required', 'string', 'max:32'],
        ]);

        $throttleKey = Str::lower($credentials['nim']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'nim' => 'Terlalu banyak percobaan. Coba lagi dalam '.RateLimiter::availableIn($throttleKey).' detik.',
            ]);
        }

        $participant = Participant::where('nim', trim($credentials['nim']))->first();

        if (! $participant || ! $participant->checkToken($credentials['token'])) {
            RateLimiter::hit($throttleKey, 60);

            throw ValidationException::withMessages([
                'token' => 'NIM atau token tidak cocok.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        Auth::guard('participant')->login($participant);
        $request->session()->regenerate();

        $participant->forceFill([
            'current_session_id' => $request->session()->getId(),
            'last_login_at' => now(),
        ])->save();

        return redirect()->intended(route('participant.dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('participant')->user()?->forceFill(['current_session_id' => null])->save();
        Auth::guard('participant')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('home');
    }
}
