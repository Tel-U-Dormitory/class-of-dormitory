import { deleteRecord, listLocked, type SectionRecord } from '@/lib/answer-store';
import { HttpError, postJson } from '@/lib/http';
import { fullyAccepted } from '@/lib/submission';
import { useCallback, useEffect, useRef, useState } from 'react';

export type UploadStatus = 'idle' | 'sending' | 'waiting' | 'auth' | 'rejected';

const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

/** Hanya jawaban yang dibuat peserta (t > 0); yang berasal dari server sudah ada di server. */
function toPayload(record: SectionRecord) {
    return Object.entries(record.answers)
        .filter(([, entry]) => entry.t > 0)
        .map(([questionId, entry]) => ({ q: Number(questionId), o: entry.o, t: entry.t }));
}

function classify(error: unknown): 'auth' | 'retry' | 'invalid' {
    if (!(error instanceof HttpError)) return 'retry'; // putus jaringan / fetch gagal
    if (error.status === 401 || error.status === 419) return 'auth';
    if ([403, 404, 422].includes(error.status)) return 'invalid';

    return 'retry'; // 429, 5xx, dan lainnya
}

/**
 * Mengirim pilar yang sudah dikunci peserta (atau habis waktu) ke server, satu request per pilar.
 * Dipasang di level halaman agar tetap berjalan walau layar sudah berpindah ke Jeda atau pilar berikutnya.
 */
export function usePendingUploader(attemptId: number, onUploaded: () => void) {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const running = useRef(false);
    const failures = useRef(0);
    const retryTimer = useRef<number | null>(null);

    const onUploadedRef = useRef(onUploaded);
    useEffect(() => {
        onUploadedRef.current = onUploaded;
    });

    const runRef = useRef<() => Promise<void>>(async () => {});

    const run = useCallback(async () => {
        if (running.current) return;
        running.current = true;

        if (retryTimer.current !== null) {
            window.clearTimeout(retryTimer.current);
            retryTimer.current = null;
        }

        try {
            for (;;) {
                const [next] = await listLocked(attemptId);

                if (!next) {
                    setStatus('idle');
                    failures.current = 0;

                    return;
                }

                setStatus('sending');

                try {
                    const answers = toPayload(next);
                    const receipt = await postJson(route('exam.checkpoint'), { section_id: next.sectionId, answers, finish: true });
                    if (!fullyAccepted(receipt, answers.length)) {
                        setStatus('rejected');
                        return; // Keep the local snapshot for recovery, including partial acceptance.
                    }
                } catch (error) {
                    const outcome = classify(error);

                    if (outcome === 'auth') {
                        setStatus('auth'); // catatan lokal tetap ada; lanjut otomatis setelah login ulang
                        return;
                    }

                    if (outcome === 'invalid') {
                        setStatus('rejected'); // kemungkinan bug payload: jangan hapus data
                        return;
                    }

                    if (outcome === 'retry') {
                        setStatus('waiting');
                        const delay = BACKOFF_MS[Math.min(failures.current, BACKOFF_MS.length - 1)] + Math.random() * 1000;
                        failures.current++;
                        retryTimer.current = window.setTimeout(() => void runRef.current(), delay);

                        return;
                    }
                }

                await deleteRecord(next.attemptId, next.sectionId);
                failures.current = 0;
                onUploadedRef.current();
            }
        } finally {
            running.current = false;
        }
    }, [attemptId]);

    useEffect(() => {
        runRef.current = run;
    }, [run]);

    // Saat halaman dibuka: kirim sisa pilar yang tertunda. Saat koneksi kembali: coba lagi segera.
    useEffect(() => {
        void run();

        const retryNow = () => {
            failures.current = 0;
            void run();
        };
        window.addEventListener('online', retryNow);

        return () => {
            window.removeEventListener('online', retryNow);
            if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
        };
    }, [run]);

    return { status, run };
}
