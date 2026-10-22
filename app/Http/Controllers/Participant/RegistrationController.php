<?php

namespace App\Http\Controllers\Participant;

use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Participant\RegisterParticipantRequest;
use App\Models\Building;
use App\Models\Participant;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RegistrationController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('participant/register', [
            'buildings' => Building::orderBy('sort_order')->get(['id', 'name']),
            'closedMessage' => Settings::registrationOpen() ? null : Settings::get('registration_closed_message'),
        ]);
    }

    public function store(RegisterParticipantRequest $request): RedirectResponse
    {
        if (! Settings::registrationOpen()) {
            return back()->with('error', Settings::get('registration_closed_message'));
        }

        $data = $request->validated();

        [$participant, $token] = DB::transaction(function () use ($data, $request) {
            $participant = new Participant([
                ...collect($data)->except(['photo', 'agreement'])->all(),
                'status' => ParticipantStatus::Registered,
                'photo_path' => $request->file('photo')->store('participants', 'local'),
            ]);
            $participant->token_hash = '';
            $participant->save();

            return [$participant, $participant->issueToken()];
        });

        // Token hanya ditampilkan sekali lewat flash session, tidak pernah disimpan dalam bentuk asli.
        return to_route('participant.registered')->with('registration', [
            'full_name' => $participant->full_name,
            'nim' => $participant->nim,
            'building' => $participant->building->name,
            'token' => $token,
        ]);
    }

    public function registered(): Response|RedirectResponse
    {
        $registration = session('registration');

        if (! $registration) {
            return to_route('participant.login');
        }

        return Inertia::render('participant/registered', ['registration' => $registration]);
    }
}
