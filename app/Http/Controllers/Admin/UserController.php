<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Akun panitia (admin & operator).
 */
class UserController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('admin/users', [
            'users' => User::orderBy('role')->orderBy('name')->get()->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role->value,
                'role_label' => $u->role->label(),
                'is_self' => $u->id === $request->user()->id,
                'created_at' => $u->created_at->toIso8601String(),
            ]),
            'roles' => collect(UserRole::cases())->map(fn ($r) => ['value' => $r->value, 'label' => $r->label()]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'password' => ['required', Password::min(8)],
        ]);

        User::create([...$data, 'email_verified_at' => now()]);

        return back()->with('success', "Akun {$data['email']} dibuat.");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'role' => ['required', Rule::enum(UserRole::class)],
            'password' => ['nullable', Password::min(8)],
        ]);

        if ($user->isAdmin() && $data['role'] !== UserRole::Admin->value && $this->isLastAdmin($user)) {
            return back()->with('error', 'Harus ada minimal satu administrator.');
        }

        $user->fill(collect($data)->except('password')->all());

        if (filled($data['password'] ?? null)) {
            $user->password = $data['password'];
        }

        $user->save();

        return back()->with('success', "Akun {$user->email} disimpan.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Tidak bisa menghapus akun sendiri.');
        }

        if ($user->isAdmin() && $this->isLastAdmin($user)) {
            return back()->with('error', 'Harus ada minimal satu administrator.');
        }

        $user->delete();

        return back()->with('success', 'Akun dihapus.');
    }

    private function isLastAdmin(User $user): bool
    {
        return User::where('role', UserRole::Admin)->whereKeyNot($user->id)->doesntExist();
    }
}
