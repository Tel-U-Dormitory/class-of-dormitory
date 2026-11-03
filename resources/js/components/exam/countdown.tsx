import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Timer } from 'lucide-react';

export function Countdown({ remainingMs, warnAtSeconds = 300, label = 'Sisa waktu' }: { remainingMs: number; warnAtSeconds?: number; label?: string }) {
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const critical = seconds <= warnAtSeconds;

    return (
        <div
            role="timer"
            aria-live={critical ? 'polite' : 'off'}
            aria-label={`${label} ${formatClock(seconds)}`}
            className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums transition-colors',
                critical ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'bg-card',
                seconds <= 60 && 'animate-pulse',
            )}
        >
            <Timer className="size-4" />
            {formatClock(seconds)}
        </div>
    );
}
