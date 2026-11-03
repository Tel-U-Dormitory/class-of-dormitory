import { postJson } from '@/lib/http';
import { useEffect, useRef, useState } from 'react';

type EventType = 'tab_hidden' | 'window_blur' | 'fullscreen_exit' | 'copy_attempt';

/**
 * Mencatat perilaku yang mencurigakan (pindah tab, keluar layar penuh, menyalin) ke server.
 * Mengembalikan flag untuk menampilkan peringatan saat peserta kembali ke halaman.
 */
export function useIntegrityMonitor(enabled: boolean) {
    const [warning, setWarning] = useState(false);
    const lastSent = useRef<Record<string, number>>({});

    useEffect(() => {
        if (!enabled) return;

        const report = (type: EventType, minIntervalMs = 3000) => {
            const now = Date.now();
            if (now - (lastSent.current[type] ?? 0) < minIntervalMs) return;
            lastSent.current[type] = now;
            postJson(route('exam.event'), { type }).catch(() => {});
        };

        const onVisibility = () => {
            if (document.hidden) {
                report('tab_hidden', 0);
                setWarning(true);
            }
        };
        const onFullscreen = () => {
            if (!document.fullscreenElement) report('fullscreen_exit');
        };
        const block = (e: Event) => {
            e.preventDefault();
            report('copy_attempt', 10000);
        };

        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('fullscreenchange', onFullscreen);
        ['copy', 'cut', 'contextmenu'].forEach((ev) => document.addEventListener(ev, block));

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('fullscreenchange', onFullscreen);
            ['copy', 'cut', 'contextmenu'].forEach((ev) => document.removeEventListener(ev, block));
        };
    }, [enabled]);

    return { warning, dismissWarning: () => setWarning(false) };
}
