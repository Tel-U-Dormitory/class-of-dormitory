<?php

namespace App\Http\Controllers\Admin;

use App\Enums\StimulusType;
use App\Http\Controllers\Admin\Concerns\GuardsQuestionBank;
use App\Http\Controllers\Controller;
use App\Models\ExamSection;
use App\Models\QuestionGroup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuestionGroupController extends Controller
{
    use GuardsQuestionBank;

    public function store(Request $request, ExamSection $section): RedirectResponse
    {
        $this->ensureQuestionBankEditable($section->exam);
        $group = new QuestionGroup(['exam_section_id' => $section->id]);
        $this->fill($request, $group);

        return back()->with('success', 'Grup soal ditambahkan.');
    }

    public function update(Request $request, QuestionGroup $group): RedirectResponse
    {
        $this->ensureQuestionBankEditable($group->section->exam);
        $this->fill($request, $group);

        return back()->with('success', 'Grup soal disimpan.');
    }

    public function destroy(QuestionGroup $group): RedirectResponse
    {
        $this->ensureQuestionBankEditable($group->section->exam);
        if ($group->section->exam->attempts()->exists()) {
            return back()->with('error', 'Ujian sudah dikerjakan peserta. Nonaktifkan soal alih-alih menghapus grup.');
        }

        $paths = collect($group->stimulus_slides ?? [])->pluck('path')->push($group->stimulus_media_path)->filter();
        $group->delete();
        Storage::disk('local')->delete($paths->all());

        return back()->with('success', 'Grup soal dihapus.');
    }

    private function fill(Request $request, QuestionGroup $group): void
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'kind' => ['nullable', 'string', 'max:60'],
            'position' => ['nullable', 'integer', 'min:0', 'max:999'],
            'stimulus_type' => ['required', Rule::enum(StimulusType::class)],
            'stimulus_text' => ['nullable', 'required_if:stimulus_type,text', 'string', 'max:20000'],
            'stimulus_duration_seconds' => ['nullable', 'required_if:stimulus_type,text,image,video', 'integer', 'min:3', 'max:600'],
            'stimulus_media' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm', 'max:51200'],
            'slides' => ['nullable', 'array', 'max:30'],
            'slides.*.path' => ['nullable', 'string'],
            'slides.*.image' => ['nullable', 'image', 'max:5120'],
            'slides.*.duration' => ['required_with:slides', 'integer', 'min:1', 'max:30'],
        ]);

        $type = StimulusType::from($data['stimulus_type']);
        $folder = 'exam-media/section-'.$group->exam_section_id;
        $oldPaths = collect($group->stimulus_slides ?? [])->pluck('path')->push($group->stimulus_media_path)->filter();

        $mediaPath = null;

        if (in_array($type, [StimulusType::Image, StimulusType::Video], true)) {
            $mediaPath = $request->hasFile('stimulus_media')
                ? $request->file('stimulus_media')->store($folder, 'local')
                : $group->stimulus_media_path;

            if (! $mediaPath) {
                throw ValidationException::withMessages(['stimulus_media' => 'Unggah file materi observasi.']);
            }
        }

        $slides = null;

        if ($type === StimulusType::Flash) {
            $existing = collect($group->stimulus_slides ?? [])->pluck('path');
            $slides = collect($data['slides'] ?? [])->map(function ($slide, $i) use ($request, $folder, $existing) {
                $path = $request->hasFile("slides.$i.image")
                    ? $request->file("slides.$i.image")->store($folder, 'local')
                    : ($existing->contains($slide['path'] ?? null) ? $slide['path'] : null);

                return $path ? ['path' => $path, 'duration' => (int) $slide['duration']] : null;
            })->filter()->values()->all();

            if (! $slides) {
                throw ValidationException::withMessages(['slides' => 'Tambahkan minimal satu slide kilasan.']);
            }
        }

        $group->fill([
            'title' => $data['title'],
            'kind' => $data['kind'] ?? null,
            'position' => $data['position'] ?? (QuestionGroup::where('exam_section_id', $group->exam_section_id)->max('position') + 1),
            'stimulus_type' => $type,
            'stimulus_text' => $type === StimulusType::Text ? $data['stimulus_text'] : null,
            'stimulus_duration_seconds' => in_array($type, [StimulusType::Text, StimulusType::Image, StimulusType::Video], true)
                ? $data['stimulus_duration_seconds']
                : null,
            'stimulus_media_path' => $mediaPath,
            'stimulus_slides' => $slides,
        ])->save();

        $keptPaths = collect($slides ?? [])->pluck('path')->push($mediaPath)->filter();
        Storage::disk('local')->delete($oldPaths->diff($keptPaths)->all());
    }
}
