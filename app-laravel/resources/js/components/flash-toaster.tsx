import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Menampilkan pesan flash `success` / `error` dari server sebagai toast. */
export function FlashToaster() {
    const { flash } = usePage<SharedData>().props;
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (flash.error) setToast({ type: 'error', message: flash.error });
        else if (flash.success) setToast({ type: 'success', message: flash.success });
    }, [flash]);

    useEffect(() => {
        if (!toast) return;
        const id = window.setTimeout(() => setToast(null), toast.type === 'error' ? 7000 : 4000);
        return () => window.clearTimeout(id);
    }, [toast]);

    if (!toast) return null;

    const Icon = toast.type === 'error' ? TriangleAlert : CheckCircle2;

    return (
        <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[60] w-[calc(100%-2rem)] max-w-sm">
            <div
                className={
                    'bg-card text-card-foreground flex items-start gap-3 rounded-lg border p-4 shadow-lg ' +
                    (toast.type === 'error' ? 'border-destructive/40' : 'border-emerald-500/40')
                }
            >
                <Icon className={toast.type === 'error' ? 'text-destructive mt-0.5 size-5 shrink-0' : 'mt-0.5 size-5 shrink-0 text-emerald-500'} />
                <p className="flex-1 text-sm">{toast.message}</p>
                <button type="button" onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
