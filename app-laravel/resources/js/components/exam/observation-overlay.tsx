import { Button } from '@/components/ui/button';
import { formatClock } from '@/lib/format';
import { Eye } from 'lucide-react';
import { type ExamGroup } from './types';

/**
 * Materi observasi layar penuh. Untuk flash, slide dipilih dari waktu yang sudah berlalu
 * sehingga tetap sinkron walau halaman dimuat ulang di tengah observasi.
 */
export function ObservationOverlay({ group, now, onFinish, finishing }: { group: ExamGroup; now: number; onFinish: () => void; finishing: boolean }) {
    const endsAt = group.observation.ends_at ?? now;
    const remaining = Math.max(0, endsAt - now);
    const stimulus = group.stimulus;
    const total = group.observation.duration_seconds * 1000;
    const progress = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100;

    let slideUrl: string | null = null;
    if (stimulus?.slides?.length) {
        const elapsed = Math.max(0, total - remaining) / 1000;
        let acc = 0;
        slideUrl = stimulus.slides[stimulus.slides.length - 1].url;
        for (const slide of stimulus.slides) {
            acc += slide.duration;
            if (elapsed < acc) {
                slideUrl = slide.url;
                break;
            }
        }
    }

    return (
        <div className="bg-background fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={`Observasi ${group.title}`}>
            <div className="bg-muted h-1 w-full">
                <div className="bg-primary h-full transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2">
                    <Eye className="text-primary size-5" />
                    <div>
                        <p className="text-sm font-semibold">Fase observasi · {group.title}</p>
                        <p className="text-muted-foreground text-xs">Materi hanya tampil sekali. Soal muncul setelah materi ditutup.</p>
                    </div>
                </div>
                <span className="font-mono text-2xl font-semibold tabular-nums">{formatClock(remaining / 1000)}</span>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
                {stimulus?.text && <div className="exam-prose bg-card max-w-3xl rounded-xl border p-6 text-lg sm:p-8">{stimulus.text}</div>}
                {group.stimulus_type === 'image' && stimulus?.media_url && (
                    <img src={stimulus.media_url} alt="Materi observasi" className="max-h-full max-w-full rounded-lg object-contain" draggable={false} />
                )}
                {group.stimulus_type === 'video' && stimulus?.media_url && (
                    <video src={stimulus.media_url} autoPlay muted playsInline className="max-h-full max-w-full rounded-lg" disablePictureInPicture />
                )}
                {slideUrl && <img key={slideUrl} src={slideUrl} alt="Kilasan" className="animate-in fade-in max-h-full max-w-full object-contain duration-200" draggable={false} />}
            </div>

            <div className="flex justify-end border-t px-4 py-3 sm:px-6">
                <Button variant="outline" onClick={onFinish} disabled={finishing}>
                    Saya sudah siap, tampilkan soal
                </Button>
            </div>
        </div>
    );
}
