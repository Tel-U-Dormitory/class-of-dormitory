<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Documentation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin]);
    }

    private function add(string $caption): void
    {
        $this->post(route('admin.documentation.store'), [
            'caption' => $caption,
            'image' => UploadedFile::fake()->image($caption.'.jpg', 800, 600),
        ])->assertSessionHasNoErrors();
    }

    public function test_admin_can_add_edit_and_delete_a_photo(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin());

        $this->add('Final');
        $item = Documentation::firstOrFail();
        Storage::disk('local')->assertExists($item->image_path);

        $oldPath = $item->image_path;
        $this->put(route('admin.documentation.update', $item), [
            'caption' => 'Final 2025',
            'image' => UploadedFile::fake()->image('baru.jpg', 800, 600),
        ])->assertSessionHasNoErrors();

        $item->refresh();
        $this->assertSame('Final 2025', $item->caption);
        Storage::disk('local')->assertMissing($oldPath);
        Storage::disk('local')->assertExists($item->image_path);

        $this->delete(route('admin.documentation.destroy', $item));
        $this->assertDatabaseCount('documentations', 0);
        Storage::disk('local')->assertMissing($item->image_path);
    }

    public function test_landing_shows_at_most_four_photos_in_order(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin());

        foreach (['a', 'b', 'c', 'd', 'e', 'f'] as $caption) {
            $this->add($caption);
        }

        $this->get(route('home'))->assertInertia(fn ($page) => $page
            ->has('documentation', 4)
            ->where('documentation.0.caption', 'a')
            ->where('documentation.3.caption', 'd'));
    }

    public function test_move_changes_which_photos_are_shown(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin());

        foreach (['a', 'b'] as $caption) {
            $this->add($caption);
        }

        $second = Documentation::where('caption', 'b')->firstOrFail();
        $this->patch(route('admin.documentation.move', $second), ['direction' => 'up']);

        $this->get(route('home'))->assertInertia(fn ($page) => $page->where('documentation.0.caption', 'b'));
    }

    public function test_landing_has_no_photos_when_table_is_empty(): void
    {
        $this->get(route('home'))->assertInertia(fn ($page) => $page->has('documentation', 0));
    }

    public function test_operator_cannot_manage_photos(): void
    {
        $this->actingAs(User::factory()->create(['role' => UserRole::Operator]))
            ->get(route('admin.documentation.index'))
            ->assertForbidden();
    }

    public function test_image_is_public(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('documentation/x.jpg', 'x');
        $item = Documentation::create(['caption' => 'x', 'image_path' => 'documentation/x.jpg', 'sort_order' => 1]);

        $this->get(route('documentation.image', $item))->assertOk();
    }
}