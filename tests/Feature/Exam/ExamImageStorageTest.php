<?php

namespace Tests\Feature\Exam;

use App\Services\Exam\ExamImageStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExamImageStorageTest extends TestCase
{
    public function test_upload_preserves_dimensions_and_original_and_can_be_discarded(): void
    {
        Storage::fake('local');
        $images = new ExamImageStorage;
        $file = UploadedFile::fake()->image('diagram.png', 800, 600);
        $path = $images->store($file, 'exam-media/test');
        $disk = Storage::disk('local');
        $disk->assertExists($path);
        $info = getimagesizefromstring($disk->get($path));
        $this->assertSame([800, 600], [$info[0], $info[1]]);
        $this->assertCount(1, $disk->files('exam-media/test/originals'));
        $this->assertLessThanOrEqual($file->getSize(), $disk->size($path));
        $images->discard();
        $this->assertSame([], $disk->allFiles());
    }
}
