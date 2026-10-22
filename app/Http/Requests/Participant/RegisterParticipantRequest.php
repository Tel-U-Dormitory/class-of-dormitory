<?php

namespace App\Http\Requests\Participant;

use Illuminate\Foundation\Http\FormRequest;

class RegisterParticipantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nim' => preg_replace('/\s+/', '', (string) $this->input('nim')),
            'achievements' => collect($this->input('achievements', []))
                ->map(fn ($item) => trim((string) $item))
                ->filter()
                ->values()
                ->all(),
        ]);
    }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:120'],
            'nim' => ['required', 'string', 'max:32', 'regex:/^[0-9A-Za-z.\-]+$/', 'unique:participants,nim'],
            'email' => ['required', 'email', 'max:255'],
            'building_id' => ['required', 'exists:buildings,id'],
            'room_number' => ['required', 'string', 'max:16'],
            'major' => ['required', 'string', 'max:120'],
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'achievements' => ['array', 'max:3'],
            'achievements.*' => ['string', 'max:200'],
            'agreement' => ['accepted'],
        ];
    }

    public function attributes(): array
    {
        return [
            'full_name' => 'nama lengkap',
            'nim' => 'NIM',
            'building_id' => 'gedung',
            'room_number' => 'nomor kamar',
            'major' => 'program studi',
            'photo' => 'foto',
            'achievements.*' => 'prestasi',
            'agreement' => 'persetujuan',
        ];
    }

    public function messages(): array
    {
        return [
            'nim.unique' => 'NIM ini sudah terdaftar. Jika kamu lupa token, hubungi panitia.',
            'agreement.accepted' => 'Kamu harus menyetujui ketentuan seleksi.',
        ];
    }
}
