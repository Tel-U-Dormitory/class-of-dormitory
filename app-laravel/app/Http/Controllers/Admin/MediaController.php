<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Participant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pratinjau media privat untuk panitia.
 */
class MediaController extends Controller
{
    public static function urlFor(?string $path): ?string
    {
        return $path ? route('admin.media', ['path' => $path]) : null;
    }

    public function show(Request $request): Response
    {
        $path = (string) $request->query('path');

        abort_unless(Str::startsWith($path, 'exam-media/') && ! Str::contains($path, '..'), 404);
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path);
    }

    public function participantPhoto(Participant $participant): Response
    {
        abort_unless($participant->photo_path && Storage::disk('local')->exists($participant->photo_path), 404);

        return Storage::disk('local')->response($participant->photo_path);
    }
}
