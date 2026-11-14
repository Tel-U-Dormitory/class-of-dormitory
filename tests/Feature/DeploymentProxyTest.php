<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DeploymentProxyTest extends TestCase
{
    public static function proxyCases(): array
    {
        return [
            'configured proxy preserves HTTPS' => [['192.0.2.10'], true],
            'untrusted client cannot spoof HTTPS' => [[], false],
        ];
    }

    #[DataProvider('proxyCases')]
    public function test_forwarded_https_requires_a_trusted_proxy(array $proxies, bool $secure): void
    {
        config(['trustedproxy.proxies' => $proxies]);
        Route::get('/deployment-proxy-test', fn (Request $request) => ['secure' => $request->isSecure()]);

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
            ->withHeaders(['X-Forwarded-Proto' => 'https'])
            ->get('/deployment-proxy-test')
            ->assertOk()
            ->assertJson(['secure' => $secure]);
    }
}
