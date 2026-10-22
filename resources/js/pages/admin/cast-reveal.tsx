import { Embers } from '@/components/embers';
import { playCorrect, preloadSounds } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Crown, Maximize, Play, RotateCcw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface CastCard {
    rank: number;
    full_name: string;
    major: string;
    building: string;
    score: number;
    photo_url: string | null;
}

interface Stage {
    key: string;
    title: string;
    subtitle: string;
    cards: CastCard[];
}

interface Props {
    exam: { id: number; title: string };
    globalKeep: number;
    stages: Stage[];
}

// Urutan waktu sama dengan versi lama: lampu sorot, lalu peringkat terbawah ke juara.
const SPOTLIGHT_AT = 500;
const REVEAL_AT = [2000, 4500, 7000, 9500];

const rankTone: Record<number, string> = {
    1: 'text-[#FFD700] [text-shadow:0_0_10px_rgba(255,215,0,0.5)]',
    2: 'text-[#C0C0C0]',
    3: 'text-[#CD7F32]',
};

export default function CastReveal({ exam, globalKeep, stages }: Props) {
    const [stageKey, setStageKey] = useState(stages.find((s) => s.key !== 'global' && s.cards.length)?.key ?? stages[0]?.key ?? '');
    const [running, setRunning] = useState(false);
    const [lit, setLit] = useState(false);
    const [revealed, setRevealed] = useState<Set<number>>(new Set());
    const [done, setDone] = useState(false);
    const timers = useRef<number[]>([]);

    const stage = stages.find((s) => s.key === stageKey);
    // Ditampilkan kiri ke kanan dari peringkat terbawah ke juara (#4 … #1).
    const cards = [...(stage?.cards ?? [])].sort((a, b) => b.rank - a.rank);

    useEffect(() => preloadSounds(), []);

    const clearTimers = () => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
    };

    const reset = useCallback(() => {
        clearTimers();
        setRunning(false);
        setLit(false);
        setRevealed(new Set());
        setDone(false);
    }, []);

    const start = useCallback(() => {
        if (!stage || !stage.cards.length) return;
        reset();
        setRunning(true);
        timers.current.push(window.setTimeout(() => setLit(true), SPOTLIGHT_AT));

        // Kartu dibuka dari peringkat terbawah; jika kurang dari 4, jadwal diambil dari belakang.
        const order = [...stage.cards].sort((a, b) => b.rank - a.rank);
        const schedule = REVEAL_AT.slice(REVEAL_AT.length - order.length);
        order.forEach((card, i) => {
            timers.current.push(
                window.setTimeout(() => {
                    setRevealed((r) => new Set([...r, card.rank]));
                    playCorrect();
                    if (card.rank === 1) setDone(true);
                }, schedule[i]),
            );
        });
        timers.current.push(window.setTimeout(() => setRunning(false), (schedule[schedule.length - 1] ?? 0) + 600));
    }, [stage, reset]);

    useEffect(() => clearTimers, []);

    // Spasi = mulai, ← → = ganti gedung, R = ulang.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'SELECT') return;
            const index = stages.findIndex((s) => s.key === stageKey);
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!running) start();
            } else if (e.key === 'ArrowRight' && !running) {
                reset();
                setStageKey(stages[(index + 1) % stages.length].key);
            } else if (e.key === 'ArrowLeft' && !running) {
                reset();
                setStageKey(stages[(index - 1 + stages.length) % stages.length].key);
            } else if (e.key.toLowerCase() === 'r') reset();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [stages, stageKey, running, start, reset]);

    const started = lit || revealed.size > 0;

    return (
        <div className="dark relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#05070a] p-6 text-white">
            <Head title={`Cast Reveal · ${stage?.title ?? ''}`} />
            <Embers className="-z-10" count={80} />

            <div
                aria-hidden
                className={cn(
                    'pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_38%_70%_at_50%_0%,rgba(245,166,35,0.17)_0%,transparent_100%)] transition-opacity duration-[1500ms]',
                    lit ? 'opacity-100' : 'opacity-0',
                )}
            />

            <div
                className={cn(
                    'absolute top-6 z-20 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#161b22]/90 p-2 backdrop-blur transition-opacity',
                    running ? 'pointer-events-none opacity-0' : 'opacity-100 hover:opacity-100',
                    started && !running && 'opacity-30',
                )}
            >
                <Link href={route('admin.exams.results', exam.id)} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Kembali ke hasil">
                    <ArrowLeft className="size-4" />
                </Link>
                <select
                    value={stageKey}
                    onChange={(e) => {
                        reset();
                        setStageKey(e.target.value);
                    }}
                    className="h-9 rounded-md border border-white/10 bg-[#0d1117] px-3 text-sm outline-none focus:border-amber-300"
                    aria-label="Pilih gedung"
                >
                    {stages.map((s) => (
                        <option key={s.key} value={s.key}>
                            {s.title} {s.cards.length ? '' : '(belum ada)'}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={start}
                    disabled={!stage?.cards.length}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-[#E50914] px-4 text-sm font-semibold hover:bg-red-500 disabled:opacity-40"
                >
                    <Play className="size-4" /> Mulai reveal
                </button>
                <button type="button" onClick={reset} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Ulang">
                    <RotateCcw className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
                    className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label="Layar penuh"
                >
                    <Maximize className="size-4" />
                </button>
            </div>

            <div className={cn('absolute top-[100px] text-center transition-all duration-700', started ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0')}>
                <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-violet-300 uppercase">
                    {stage?.key === 'global' ? 'Peringkat global' : 'Seleksi asrama'}
                </span>
                <h1 className="font-display mt-3 bg-gradient-to-b from-[#FFC837] to-[#FF8008] bg-clip-text text-5xl font-bold text-transparent uppercase drop-shadow-[0_0_40px_rgba(229,9,20,0.5)] md:text-6xl">
                    {stage?.title}
                </h1>
            </div>

            <div className="mt-24 flex max-w-[1200px] flex-wrap justify-center gap-6 [perspective:1000px]">
                {!started && (
                    <p className="max-w-md text-center text-lg text-slate-500">
                        Pilih gedung lalu tekan <strong className="text-slate-300">Mulai reveal</strong> (atau Spasi). ← → untuk berpindah gedung.
                    </p>
                )}
                {started &&
                    cards.map((card) => {
                        const isRevealed = revealed.has(card.rank);
                        return (
                            <article
                                key={card.rank}
                                className={cn(
                                    'flex h-[380px] w-[240px] flex-col items-center rounded-2xl border bg-gradient-to-br from-[#161b22]/90 to-[#0d1117]/95 p-4 text-center shadow-[0_16px_48px_rgba(0,0,0,0.7)] transition-all duration-[900ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
                                    isRevealed
                                        ? 'border-[#f5a623] opacity-100 shadow-[0_0_25px_rgba(245,166,35,0.25)] [transform:rotateY(0)_scale(1)]'
                                        : 'border-white/10 opacity-0 [transform:rotateY(90deg)_scale(0.8)]',
                                    card.rank === 1 && isRevealed && 'shadow-[0_0_50px_rgba(255,215,0,0.35)]',
                                )}
                            >
                                <div className={cn('font-display text-2xl leading-none font-bold text-slate-400', rankTone[card.rank])}>#{card.rank}</div>
                                {card.photo_url ? (
                                    <img
                                        src={card.photo_url}
                                        alt={card.full_name}
                                        className={cn('my-4 size-[120px] rounded-full border-[3px] object-cover transition-colors duration-500', isRevealed ? 'border-[#f5a623]' : 'border-white/10')}
                                    />
                                ) : (
                                    <div className="my-4 flex size-[120px] items-center justify-center rounded-full border-[3px] border-[#f5a623] bg-slate-900">
                                        <UserRound className="size-12 text-slate-500" />
                                    </div>
                                )}
                                <h2 className="mb-1 text-lg leading-tight font-bold">{card.full_name}</h2>
                                <p className="text-xs text-slate-400">{card.major}</p>
                                {stage?.key === 'global' && <p className="mt-1 text-xs text-amber-300">{card.building}</p>}
                                <p className="mt-auto rounded border border-[#f5a623]/20 bg-[#f5a623]/10 px-3 py-1 font-mono text-sm text-[#f5a623]">{card.score} poin</p>
                            </article>
                        );
                    })}
            </div>

            <div className={cn('absolute bottom-[6%] w-[90%] max-w-3xl text-center transition-all duration-700', done ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
                <p className="font-display flex items-center justify-center gap-3 text-xl font-bold text-[#E50914] [text-shadow:0_0_20px_rgba(229,9,20,0.5)] md:text-2xl">
                    <Crown className="size-6 text-[#FFD700]" />
                    {stage?.key === 'global' ? `Selamat Top ${globalKeep} Global!` : `Selamat ${cards.length} Cast Utama ${stage?.title}!`}
                    <Crown className="size-6 text-[#FFD700]" />
                </p>
                <p className="mt-1 text-sm text-slate-400">
                    {stage?.key === 'global' ? 'Lolos langsung tanpa bersaing di kuota gedung.' : `${globalKeep} peringkat teratas global di-keep dan lolos langsung ke Top ${globalKeep} Global.`}
                </p>
            </div>
        </div>
    );
}
