<?php

namespace App\Services\Exam;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class ExamMediaResponse
{
    public function file(string $path): Response
    {
        abort_unless(str_starts_with($path, 'exam-media/') && ! str_contains($path, '..') && ! str_contains($path, '\\'), 404);
        $disk = Storage::disk('local');
        abort_unless($disk->exists($path), 404);
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'];
        if (config('exam-media.accel_redirect')) {
            return response('', 200, $headers + [
                'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
                'X-Accel-Redirect' => '/_exam-media/'.implode('/', array_map('rawurlencode', explode('/', substr($path, strlen('exam-media/'))))),
            ]);
        }

        return $disk->response($path, null, $headers);
    }
}
