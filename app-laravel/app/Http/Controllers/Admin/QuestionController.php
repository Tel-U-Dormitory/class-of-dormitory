<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\QuestionGroup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class QuestionController extends Controller
{
    public function store(Request $request, QuestionGroup $group): RedirectResponse
    {
        $this->save($request, new Question(['question_group_id' => $group->id]));

        return back()->with('success', 'Soal ditambahkan.');
    }

    public function update(Request $request, Question $question): RedirectResponse
    {
        $this->save($request, $question);

        return back()->with('success', 'Soal disimpan.');
    }

    public function destroy(Question $question): RedirectResponse
    {
        if ($question->answers()->exists()) {
            $question->update(['is_active' => false]);

            return back()->with('success', 'Soal sudah pernah dijawab, jadi dinonaktifkan (tidak dihapus).');
        }

        $paths = $question->options_are_images ? $question->options->pluck('content') : collect();
        $paths->push($question->image_path);

        $question->delete();
        Storage::disk('local')->delete($paths->filter()->all());

        return back()->with('success', 'Soal dihapus.');
    }

    private function save(Request $request, Question $question): void
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'is_latex' => ['boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'remove_image' => ['boolean'],
            'options_are_images' => ['boolean'],
            'points' => ['required', 'integer', 'min:0', 'max:100'],
            'penalty' => ['required', 'integer', 'min:0', 'max:100'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'position' => ['nullable', 'integer', 'min:0', 'max:999'],
            'correct_option' => ['required', 'integer', 'min:0'],
            'options' => ['required', 'array', 'min:2', 'max:6'],
            'options.*.content' => ['nullable', 'string', 'max:2000'],
            'options.*.image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($data['correct_option'] >= count($data['options'])) {
            throw ValidationException::withMessages(['correct_option' => 'Pilih kunci jawaban yang valid.']);
        }

        $folder = 'exam-media/section-'.QuestionGroup::findOrFail($question->question_group_id)->exam_section_id;
        $asImages = (bool) ($data['options_are_images'] ?? false);

        DB::transaction(function () use ($request, $question, $data, $folder, $asImages) {
            $imagePath = $question->image_path;

            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store($folder, 'local');
            } elseif ($data['remove_image'] ?? false) {
                $imagePath = null;
            }

            if ($imagePath !== $question->image_path && $question->image_path) {
                Storage::disk('local')->delete($question->image_path);
            }

            $question->fill([
                'body' => $data['body'],
                'is_latex' => (bool) ($data['is_latex'] ?? false),
                'image_path' => $imagePath,
                'options_are_images' => $asImages,
                'points' => $data['points'],
                'penalty' => $data['penalty'],
                'is_active' => (bool) ($data['is_active'] ?? true),
                'notes' => $data['notes'] ?? null,
                'position' => $data['position'] ?? (Question::where('question_group_id', $question->question_group_id)->max('position') + 1),
            ])->save();

            $existing = $question->options()->get()->keyBy('position');

            foreach ($data['options'] as $i => $option) {
                $current = $existing->get($i);

                if ($asImages) {
                    $content = $request->hasFile("options.$i.image")
                        ? $request->file("options.$i.image")->store($folder, 'local')
                        : ($current && $current->content && Storage::disk('local')->exists($current->content) ? $current->content : null);
                } else {
                    $content = trim((string) ($option['content'] ?? ''));
                }

                if ($content === null || $content === '') {
                    throw ValidationException::withMessages(["options.$i.content" => 'Pilihan '.chr(65 + $i).' wajib diisi.']);
                }

                $question->options()->updateOrCreate(
                    ['position' => $i],
                    ['content' => $content, 'is_correct' => $i === (int) $data['correct_option']],
                );
            }

            $question->options()->where('position', '>=', count($data['options']))->delete();
        });
    }
}
