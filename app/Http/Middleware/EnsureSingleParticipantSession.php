<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Satu peserta hanya boleh aktif di satu perangkat. Login baru mengeluarkan sesi lama.
 */
class EnsureSingleParticipantSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $participant = Auth::guard('participant')->user();

        if ($participant && $participant->current_session_id !== $request->session()->getId()) {
            Auth::guard('participant')->logout();
            $request->session()->regenerateToken();

            return redirect()->route('participant.login')
                ->with('error', 'Akunmu masuk di perangkat lain, sehingga sesi ini dikeluarkan.');
        }

        return $next($request);
    }
}
