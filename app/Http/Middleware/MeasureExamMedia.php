<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class MeasureExamMedia
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('exam-media.log_requests')) {
            return $next($request);
        }
        $started = hrtime(true);
        $before = DB::connection()->totalQueryDuration();
        $response = null;
        try {
            return $response = $next($request);
        } finally {
            Log::info('exam_media_request', [
                'route' => $request->route()?->getName(),
                'media_id' => $request->route('question') ?? $request->route('option') ?? $request->route('group'),
                'status' => $response?->getStatusCode(),
                'duration_ms' => round((hrtime(true) - $started) / 1e6, 2),
                'database_ms' => round(DB::connection()->totalQueryDuration() - $before, 2),
            ]);
        }
    }
}
