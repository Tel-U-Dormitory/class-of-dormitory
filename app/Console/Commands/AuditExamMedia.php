<?php

namespace App\Console\Commands;

use App\Models\Exam;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class AuditExamMedia extends Command
{
    protected $signature = 'exam:audit-media {exam : Exam ID}';

    protected $description = 'Read-only audit of exam images: readability, dimensions, size and duplicate hashes';

    public function handle(): int
    {
        $exam = Exam::with('sections.groups.questions.options')->findOrFail($this->argument('exam'));
        $paths = [];
        foreach ($exam->sections as $section) {
            foreach ($section->groups as $group) {
                if ($group->stimulus_type->value === 'image' && $group->stimulus_media_path) {
                    $paths['group:'.$group->id] = $group->stimulus_media_path;
                }
                foreach ($group->stimulus_slides ?? [] as $index => $slide) {
                    $paths['slide:'.$group->id.':'.$index] = $slide['path'];
                }
                foreach ($group->questions as $question) {
                    if ($question->image_path) {
                        $paths['question:'.$question->id] = $question->image_path;
                    }
                    if ($question->options_are_images) {
                        foreach ($question->options as $option) {
                            $paths['option:'.$option->id] = $option->content;
                        }
                    }
                }
            }
        }
        $rows = [];
        $hashes = [];
        $failed = false;
        foreach ($paths as $id => $path) {
            $absolute = Storage::disk('local')->path($path);
            $info = is_readable($absolute) ? @getimagesize($absolute) : false;
            if (! $info) {
                $rows[] = [$id, $path, 'MISSING/INVALID', '-', '-'];
                $failed = true;

                continue;
            }
            $hash = hash_file('sha256', $absolute);
            $duplicate = $hashes[$hash] ?? '-';
            $hashes[$hash] ??= $id;
            $rows[] = [$id, $path, $info[0].'x'.$info[1], filesize($absolute), $duplicate];
        }
        $this->table(['Media', 'Path', 'Dimensions', 'Bytes', 'Identical to'], $rows);
        $this->info('Duplicates require source review; no files or database records were changed.');

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
