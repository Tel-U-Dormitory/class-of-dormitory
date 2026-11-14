<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreParticipantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null; // route sudah dilindungi middleware 'auth'
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nim' => preg_replace('/\s+/', '', (string) $this->input('nim')),
            'achievements' => collect($this->input('achievements', []))
                ->map(fn ($i) => trim((string) $i))->filter()->values()->all(),
        ]);
    }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:120'],
            'nim' => ['required', 'string', 'max:32', 'regex:/^[0-9A-Za-z.\-]+$/', 'unique:participants,nim'],
            'email' => ['nullable', 'email', 'max:255'],
            'building_id' => ['required', 'exists:buildings,id'],
            'room_number' => ['required', 'string', 'max:16'],
            'major' => ['required', 'string', 'max:120'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'achievements' => ['array', 'max:3'],
            'achievements.*' => ['string', 'max:200'],
        ];
    }

    public function messages(): array
    {
        return ['nim.unique' => 'NIM ini sudah terdaftar.'];
    }
}