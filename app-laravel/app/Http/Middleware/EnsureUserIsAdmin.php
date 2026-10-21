<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Operator hanya bisa memantau; perubahan bank soal dan pengaturan ujian khusus admin.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Hanya administrator yang dapat mengakses halaman ini.');

        return $next($request);
    }
}
