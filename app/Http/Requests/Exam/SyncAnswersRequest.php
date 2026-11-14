<?php

namespace App\Http\Requests\Exam;

use Illuminate\Foundation\Http\FormRequest;

class SyncAnswersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'section_id' => ['required', 'integer'],
            'finish' => ['sometimes', 'boolean'],
            'answers' => ['present', 'array', 'max:'.config('exam.max_answers_per_sync', 500)],
            'answers.*.q' => ['required', 'integer'],
            'answers.*.o' => ['nullable', 'integer'],
            'answers.*.t' => ['nullable', 'integer', 'min:0'],
        ];
    }
}