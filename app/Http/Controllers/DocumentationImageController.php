<?php

namespace App\Http\Controllers;

use App\Models\Documentation;
use Illuminate\Support\Facades\Storage;

class DocumentationImageController extends Controller
{
    public function __invoke(Documentation $documentation)
    {
        abort_unless(Storage::disk('local')->exists($documentation->image_path), 404);

        return Storage::disk('local')->response($documentation->image_path, null, [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}