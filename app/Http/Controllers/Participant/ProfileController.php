<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $p = $request->user('participant');

        return Inertia::render('participant/profile', [
            'participant' => [
                'full_name' => $p->full_name,
                'nim' => $p->nim,
                'achievements' => $p->achievements ?? [],
                'photo_url' => $p->photo_path ? route('participant.photo') : null,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->merge([
            'achievements' => collect($request->input('achievements', []))
                ->map(fn ($i) => trim((string) $i))
                ->filter()
                ->values()
                ->all(),
        ]);

        $data = $request->validate([
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'achievements' => ['array', 'max:3'],
            'achievements.*' => ['string', 'max:200'],
        ], [], [
            'photo' => 'foto',
            'achievements.*' => 'prestasi',
        ]);

        $p = $request->user('participant');

        if ($request->hasFile('photo')) {
            if ($p->photo_path) {
                Storage::disk('local')->delete($p->photo_path);
            }
            $p->photo_path = $request->file('photo')->store('participants', 'local');
        }

        $p->achievements = $data['achievements'];
        $p->save();

        return to_route('participant.dashboard')->with('success', 'Profil diperbarui.');
    }
}