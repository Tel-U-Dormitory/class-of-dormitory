import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

/**
 * Percikan bara merah-emas yang melayang naik (efek latar versi lama).
 * Dinonaktifkan otomatis untuk pengguna yang memilih "kurangi animasi".
 */
export function Embers({ count = 65, className }: { count?: number; className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        let frame = 0;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            width = canvas.width = rect.width;
            height = canvas.height = rect.height;
        };
        resize();
        window.addEventListener('resize', resize);

        type Ember = { x: number; y: number; size: number; vy: number; vx: number; alpha: number; fade: number; gold: boolean };
        const spawn = (initial: boolean): Ember => ({
            x: Math.random() * width,
            y: initial ? Math.random() * height : height + 10,
            size: Math.random() * 2.5 + 0.5,
            vy: Math.random() * 0.8 + 0.3,
            vx: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.8 + 0.2,
            fade: Math.random() * 0.005 + 0.002,
            gold: Math.random() > 0.4,
        });
        const embers = Array.from({ length: count }, () => spawn(true));

        const tick = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#e50914';
            for (let i = 0; i < embers.length; i++) {
                const e = embers[i];
                e.y -= e.vy;
                e.x += e.vx + Math.sin(e.y * 0.01) * 0.3;
                e.alpha -= e.fade;
                if (e.y < -10 || e.alpha <= 0) {
                    embers[i] = spawn(false);
                    continue;
                }
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
                ctx.fillStyle = e.gold ? `rgba(255, 200, 55, ${e.alpha})` : `rgba(229, 9, 20, ${e.alpha})`;
                ctx.fill();
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', resize);
        };
    }, [count]);

    return <canvas ref={canvasRef} aria-hidden className={cn('pointer-events-none fixed inset-0 z-0 size-full opacity-70', className)} />;
}
