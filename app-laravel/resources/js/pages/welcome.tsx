import { Button } from '@/components/ui/button';
import PublicLayout from '@/layouts/public-layout';
import { formatDate } from '@/lib/format';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { type Pillar, type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, CalendarDays, Clock, ShieldCheck } from 'lucide-react';

interface Props {
    exam: { title: string; description: string | null; is_open: boolean; scheduled_at: string | null; total_minutes: number } | null;
    pillars: { value: Pillar; label: string; description: string }[];
}

const steps = [
    { title: 'Daftar', body: 'Isi data diri dan foto. Kamu langsung mendapat token login pribadi.' },
    { title: 'Ujian seleksi', body: 'Kerjakan 4 pilar kognitif secara berurutan, masing-masing dengan batas waktu sendiri.' },
    { title: 'Pengumuman', body: 'Peringkat dihitung per gedung. Peserta terbaik tiap gedung menjadi cast.' },
    { title: 'Babak utama', body: 'Cast bertanding di chapter, challenge, dan deathmatch Season 3.' },
];

export default function Welcome({ exam, pillars }: Props) {
    const { auth } = usePage<SharedData>().props;

    return (
        <PublicLayout>
            <Head title="Season 3" />

            <section className="relative overflow-hidden">
                <div
                    aria-hidden
                    className="absolute inset-0 bg-[url('/images/bg.webp')] bg-cover bg-center opacity-20"
                />
                <div aria-hidden className="from-background/40 via-background/80 to-background absolute inset-0 bg-gradient-to-b" />
                <div
                    aria-hidden
                    className="bg-primary/25 absolute top-1/3 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                />

                <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24 sm:pb-28">
                    <span className="border-gold/40 text-gold mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wider uppercase">
                        Season 3 · Seleksi Massal
                    </span>
                    <img src="/images/logo.webp" alt="Clash of Dormitory" className="w-full max-w-2xl drop-shadow-2xl" width={1400} height={400} />
                    <p className="text-muted-foreground mt-6 max-w-xl text-base sm:text-lg">
                        Kompetisi kognitif antar-asrama. Uji daya ingat, nalar ruang, angka, dan logika untuk mewakili gedungmu.
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        {auth.participant ? (
                            <Button asChild size="lg">
                                <Link href={route('exam.lobby')}>
                                    Masuk ruang ujian <ArrowRight />
                                </Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild size="lg">
                                    <Link href={route('participant.register')}>
                                        Daftar sekarang <ArrowRight />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href={route('participant.login')}>Saya sudah punya token</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {exam && (
                        <dl className="border-border/70 bg-card/60 mt-12 grid w-full max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-xl border backdrop-blur sm:grid-cols-3">
                            <div className="flex items-center gap-3 p-4 text-left">
                                <CalendarDays className="text-gold size-5 shrink-0" />
                                <div>
                                    <dt className="text-muted-foreground text-xs">Jadwal</dt>
                                    <dd className="text-sm font-medium">{exam.scheduled_at ? formatDate(exam.scheduled_at) : 'Diumumkan panitia'}</dd>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 text-left">
                                <Clock className="text-gold size-5 shrink-0" />
                                <div>
                                    <dt className="text-muted-foreground text-xs">Durasi</dt>
                                    <dd className="text-sm font-medium">{exam.total_minutes} menit · 4 pilar</dd>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 text-left">
                                <ShieldCheck className="text-gold size-5 shrink-0" />
                                <div>
                                    <dt className="text-muted-foreground text-xs">Status</dt>
                                    <dd className="text-sm font-medium">{exam.is_open ? 'Ujian sedang dibuka' : 'Belum dibuka'}</dd>
                                </div>
                            </div>
                        </dl>
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
                <div className="mb-10 max-w-2xl">
                    <h2 className="font-display text-2xl font-bold sm:text-3xl">Empat pilar kognitif</h2>
                    <p className="text-muted-foreground mt-2">Setiap pilar dikerjakan berurutan dan terkunci setelah selesai. Ada jeda singkat di antara pilar.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pillars.map((pillar, i) => {
                        const meta = pillarMeta[pillar.value];
                        return (
                            <article key={pillar.value} className="bg-card relative overflow-hidden rounded-xl border p-5">
                                <div className={cn('absolute inset-x-0 top-0 h-1', meta.bg)} />
                                <div className="flex items-center justify-between">
                                    <meta.icon className={cn('size-6', meta.text)} />
                                    <span className="text-muted-foreground text-xs tabular-nums">Pilar {i + 1}</span>
                                </div>
                                <h3 className="mt-4 text-lg font-semibold">{pillar.label}</h3>
                                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{pillar.description}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="border-border/60 bg-card/30 border-y">
                <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
                    <h2 className="font-display text-2xl font-bold sm:text-3xl">Alur Season 3</h2>
                    <ol className="mt-10 grid gap-6 md:grid-cols-4">
                        {steps.map((step, i) => (
                            <li key={step.title} className="relative">
                                <div className="flex items-center gap-3">
                                    <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                                        {i + 1}
                                    </span>
                                    <h3 className="font-semibold">{step.title}</h3>
                                </div>
                                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{step.body}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Dokumentasi season lalu</h2>
                <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => (
                        <img
                            key={n}
                            src={`/images/doc${n}.webp`}
                            alt={`Dokumentasi Clash of Dormitory ${n}`}
                            loading="lazy"
                            className="aspect-[4/3] w-full rounded-lg border object-cover"
                        />
                    ))}
                </div>
            </section>
        </PublicLayout>
    );
}
