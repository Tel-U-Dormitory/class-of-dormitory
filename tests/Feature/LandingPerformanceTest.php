<?php

namespace Tests\Feature;

use App\Models\Documentation;
use App\Models\Exam;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LandingPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_guest_page_does_not_query_exam_or_documentation_data(): void
    {
        Settings::registrationOpen();
        DB::enableQueryLog();
        $response = $this->get(route('home'))->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertEmpty($queries, 'A warm local settings cache must let the guest page render without a database round trip.');
        $response->assertInertia(fn (Assert $page) => $page
            ->component('welcome')->has('pillars', 4)->missing('landing'));
    }

    public function test_deferred_data_keeps_current_exam_and_documentation(): void
    {
        $exam = Exam::factory()->create(['title' => 'Ujian terkini', 'status' => 'closed']);
        Documentation::create(['caption' => 'Foto terbaru', 'image_path' => 'documentation/test.webp', 'sort_order' => 1]);

        $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->missing('landing')
            ->loadDeferredProps(fn (Assert $page) => $page
                ->where('landing.exam.title', $exam->title)
                ->where('landing.documentation.0.caption', 'Foto terbaru')
                ->where('landing.castOpen', false)
                ->where('landing.result', null)));
    }
}
