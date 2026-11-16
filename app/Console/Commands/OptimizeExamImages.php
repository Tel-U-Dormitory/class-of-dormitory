<?php

namespace App\Console\Commands;

use App\Enums\ExamStatus;
use App\Models\Exam;
use App\Services\Exam\ExamImageStorage;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OptimizeExamImages extends Command
{
    protected $signature = 'exam:optimize-images {exam} {--apply : Apply to an unused draft; default only lists candidates}';

    protected $description = 'Optimize existing images on an unused draft, preserving old files and a path manifest';

    public function handle(): int
    {
        $images = new ExamImageStorage;
        $manifest = [];
        $apply = (bool) $this->option('apply');
        $manifestPath = 'exam-media/manifests/'.Str::uuid().'.json';
        try {
            DB::transaction(function () use ($images, &$manifest, $apply, $manifestPath) {
                $exam = Exam::lockForUpdate()->findOrFail($this->argument('exam'));
                if ($apply && ($exam->status !== ExamStatus::Draft || $exam->attempts()->exists())) {
                    throw new \RuntimeException('Apply hanya untuk draft tanpa attempt. Salin ujian lama terlebih dahulu.');
                }
                $convert = function (string $path) use ($images, &$manifest, $apply): string {
                    $absolute = Storage::disk('local')->path($path);
                    $info = is_readable($absolute) ? @getimagesize($absolute) : false;
                    if (! $info) {
                        throw new \RuntimeException('Gambar hilang/tidak valid: '.$path);
                    }
                    if (! in_array($info['mime'], ['image/png', 'image/jpeg'], true)) {
                        return $path;
                    }
                    $this->line($path.' ('.filesize($absolute).' bytes)');
                    if (! $apply) {
                        return $path;
                    }
                    if (isset($manifest[$path])) {
                        return $manifest[$path];
                    }
                    $new = $images->store(new UploadedFile($absolute, basename($path), null, null, true), dirname($path));
                    if (! str_ends_with($new, '.webp')) {
                        Storage::disk('local')->delete($new);
                        $new = $path;
                    }

                    return $manifest[$path] = $new;
                };
                foreach ($exam->sections()->with('groups.questions.options')->get() as $section) {
                    foreach ($section->groups as $group) {
                        if ($group->stimulus_type->value === 'image' && $group->stimulus_media_path) {
                            $group->stimulus_media_path = $convert($group->stimulus_media_path);
                        }
                        if ($group->stimulus_slides) {
                            $slides = $group->stimulus_slides;
                            foreach ($slides as &$slide) {
                                $slide['path'] = $convert($slide['path']);
                            }
                            unset($slide);
                            $group->stimulus_slides = $slides;
                        }
                        if ($apply) {
                            $group->save();
                        }
                        foreach ($group->questions as $question) {
                            if ($question->image_path) {
                                $question->image_path = $convert($question->image_path);
                                if ($apply) {
                                    $question->save();
                                }
                            }
                            if ($question->options_are_images) {
                                foreach ($question->options as $option) {
                                    $option->content = $convert($option->content);
                                    if ($apply) {
                                        $option->save();
                                    }
                                }
                            }
                        }
                    }
                }
                if ($apply && ! Storage::disk('local')->put($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                    throw new \RuntimeException('Gagal menyimpan manifest.');
                }
            });
        } catch (\Throwable $e) {
            $images->discard();
            Storage::disk('local')->delete($manifestPath);
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info($apply ? 'Selesai. File lama dipertahankan; manifest: '.$manifestPath : 'Dry run; tidak ada perubahan. Gunakan --apply pada draft tanpa attempt.');

        return self::SUCCESS;
    }
}
