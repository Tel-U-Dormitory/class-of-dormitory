const locale = 'id-ID';

export function formatDateTime(value: string | number | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatDate(value: string | number | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(value));
}

/** Detik → "mm:ss" atau "h:mm:ss". */
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
    if (totalSeconds == null) return '—';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`;
}

export function formatRelative(ms: number | null, now: number): string {
    if (!ms) return '—';
    const diff = Math.round((now - ms) / 1000);
    if (diff < 10) return 'baru saja';
    if (diff < 60) return `${diff} dtk lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    return `${Math.floor(diff / 3600)} jam lalu`;
}
