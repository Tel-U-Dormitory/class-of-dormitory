import { cn } from '@/lib/utils';
import { useEffect } from 'react';

/** Layar penuh merah/hijau setelah menjawab (seperti versi lama). Klik atau tekan tombol apa pun untuk menutup. */
export function ResultOverlay({ result, detail, onClose }: { result: 'correct' | 'wrong' | 'sent'; detail?: string | null; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            e.preventDefault();
            onClose();
        };
        const id = window.setTimeout(() => window.addEventListener('keydown', onKey), 300);
        return () => {
            window.clearTimeout(id);
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const title = { correct: 'Jawaban Benar', wrong: 'Jawaban Salah', sent: 'Jawaban Terkirim' }[result];

    return (
        <button
            type="button"
            onClick={onClose}
            className={cn(
                'animate-in fade-in fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-4 border-4 p-8 text-center backdrop-blur-xl duration-150',
                result === 'correct' && 'border-green-500 bg-green-900/95',
                result === 'wrong' && 'border-red-500 bg-red-900/95',
                result === 'sent' && 'border-amber-400 bg-slate-950/95',
            )}
        >
            <span className="font-display text-4xl font-bold tracking-[0.12em] text-white uppercase sm:text-6xl">{title}</span>
            {detail && <span className="font-mono text-lg text-white/85 sm:text-2xl">{detail}</span>}
            <span className="mt-6 text-sm text-white/60">Ketuk di mana saja untuk lanjut</span>
        </button>
    );
}
