/**
 * POST JSON kecil (simpan jawaban, log event) tanpa memuat ulang halaman Inertia.
 * Token CSRF diambil dari cookie XSRF-TOKEN yang dikirim Laravel.
 */
export class HttpError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
    }
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export async function postJson<T = unknown>(url: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new HttpError((data as { message?: string }).message ?? 'Terjadi kesalahan jaringan.', response.status);
    }

    return data as T;
}
