<?php

namespace App\Services\Exam;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ExamImageStorage
{
    private array $created = [];

    public function discard(): void
    {
        Storage::disk('local')->delete($this->created);
    }

    public function store(UploadedFile $file, string $folder): string
    {
        $info = @getimagesize($file->getRealPath());
        if (! $info || $info[0] * $info[1] > 12000000) {
            throw ValidationException::withMessages(['image' => 'Gambar tidak valid atau melebihi 12 megapiksel.']);
        }

        $disk = Storage::disk('local');
        $original = $file->store($folder.'/originals', 'local');
        if (! $original) {
            throw new RuntimeException('Gagal menyimpan gambar asli.');
        }
        $this->created[] = $original;

        try {
            // GD drops EXIF orientation. Keep such JPEGs intact rather than rotating diagrams.
            if ($info['mime'] === 'image/jpeg' && str_contains(file_get_contents($file->getRealPath()), "Exif\0\0")) {
                return $original;
            }
            // Keep GIF/WebP intact (including animation); never resize spatial diagrams.
            if (! in_array($info['mime'], ['image/png', 'image/jpeg'], true)
                || ! function_exists('imagewebp') || ! defined('IMG_WEBP_LOSSLESS')) {
                return $original;
            }

            $image = @imagecreatefromstring(file_get_contents($file->getRealPath()));
            if (! $image) {
                throw new RuntimeException('Gagal membaca gambar.');
            }
            ob_start();
            try {
                imagepalettetotruecolor($image);
                imagesavealpha($image, true);
                imagewebp($image, null, IMG_WEBP_LOSSLESS);
                $webp = ob_get_contents();
            } finally {
                ob_end_clean();
                imagedestroy($image);
            }

            if (! $webp || strlen($webp) >= $file->getSize() || ! @getimagesizefromstring($webp)) {
                return $original;
            }
            $path = $folder.'/'.Str::uuid().'.webp';
            if (! $disk->put($path, $webp)) {
                throw new RuntimeException('Gagal menyimpan WebP.');
            }
            $this->created[] = $path;

            return $path;
        } catch (\Throwable $e) {
            $disk->delete($original);
            throw $e;
        }
    }
}
