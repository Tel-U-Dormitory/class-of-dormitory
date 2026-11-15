<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Documentation;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Foto "Dokumentasi season lalu" di beranda. Beranda hanya menampilkan
 * Documentation::LANDING_LIMIT foto teratas menurut urutan.
 */
class DocumentationController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/documentation', [
            'items' => Documentation::ordered()->get()->map(fn (Documentation $d) => [
                'id' => $d->id,
                'caption' => $d->caption,
                'url' => $d->imageUrl(),
            ]),
            'landingLimit' => Documentation::LANDING_LIMIT,
            'title' => Settings::get('documentation_title'),
        ]);
    }

    /** Judul besar bagian dokumentasi di beranda. */
    public function updateTitle(Request $request): RedirectResponse
    {
        $data = $request->validate(['title' => ['required', 'string', 'max:80']]);

        Settings::set('documentation_title', trim($data['title']));

        return back()->with('success', 'Judul dokumentasi disimpan.');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'caption' => ['nullable', 'string', 'max:120'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        Documentation::create([
            'caption' => $data['caption'] ?? null,
            'image_path' => $request->file('image')->store('documentation', 'local'),
            'sort_order' => (int) Documentation::max('sort_order') + 1,
        ]);

        return back()->with('success', 'Foto dokumentasi ditambahkan.');
    }

    public function update(Request $request, Documentation $documentation): RedirectResponse
    {
        $data = $request->validate([
            'caption' => ['nullable', 'string', 'max:120'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $oldPath = null;
        $documentation->caption = $data['caption'] ?? null;

        if ($request->hasFile('image')) {
            $oldPath = $documentation->image_path;
            $documentation->image_path = $request->file('image')->store('documentation', 'local');
        }

        $documentation->save();

        if ($oldPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return back()->with('success', 'Foto dokumentasi disimpan.');
    }

    public function destroy(Documentation $documentation): RedirectResponse
    {
        $path = $documentation->image_path;
        $documentation->delete();
        Storage::disk('local')->delete($path);

        return back()->with('success', 'Foto dokumentasi dihapus.');
    }

    /** Geser satu posisi ke atas atau ke bawah. */
    public function move(Request $request, Documentation $documentation): RedirectResponse
    {
        $direction = $request->validate(['direction' => ['required', 'in:up,down']])['direction'];

        DB::transaction(function () use ($documentation, $direction) {
            $ids = Documentation::ordered()->lockForUpdate()->pluck('id')->all();
            $index = array_search($documentation->id, $ids, true);
            $swap = $direction === 'up' ? $index - 1 : $index + 1;

            if ($index === false || ! isset($ids[$swap])) {
                return;
            }

            [$ids[$index], $ids[$swap]] = [$ids[$swap], $ids[$index]];

            foreach ($ids as $position => $id) {
                Documentation::whereKey($id)->update(['sort_order' => $position + 1]);
            }
        });

        return back();
    }
}