import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { formatDateTime } from '@/lib/format';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { type Pillar } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CircleCheck, Clock, LoaderCircle, Lock } from 'lucide-react';
import { useState } from 'react';

interface Props {
    exam: {
        title: string;
        is_open: boolean;
        scheduled_at: string | null;
        announcement: string | null;
        break_minutes: number;
        sections: { pillar: Pillar; label: string; minutes: number; description: string }[];
    } | null;
    hasActiveAttempt: boolean;
}

const rules = [
    'Pilar dikerjakan berurutan. Pilar yang sudah selesai terkunci dan tidak bisa dibuka kembali.',
    'Waktu tiap pilar dihitung oleh server. Memuat ulang halaman tidak menghentikan atau mengulang waktu.',
    'Materi hafalan (Memory) hanya ditampilkan satu kali. Soalnya baru muncul setelah materi ditutup.',
    'Skor: benar +4, salah −1, kosong 0. Jika ragu, lebih baik dikosongkan.',
    'Berpindah tab atau jendela tercatat otomatis dan dilaporkan ke panitia.',
    'Jika koneksi terputus, masuk kembali. Jawaban yang sudah tersimpan tidak hilang.',
];

export default function Lobby({ exam, hasActiveAttempt }: Props) {
    const [agreed, setAgreed] = useState(hasActiveAttempt);
    const [starting, setStarting] = useState(false);

    const start = () => {
        setStarting(true);
        document.documentElement.requestFullscreen?.().catch(() => {});
        router.post(route('exam.start'), {}, { onFinish: () => setStarting(false) });
    };

    return (
        <PublicLayout className="px-4 py-10 sm:px-6">
            <Head title="Ruang Ujian" />

            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <p className="text-muted-foreground text-sm">Ruang ujian</p>
                    <h1 className="font-display mt-1 text-2xl font-bold sm:text-3xl">{exam?.title ?? 'Belum ada ujian'}</h1>
                </div>

                {!exam ? (
                    <Card>
                        <CardContent className="text-muted-foreground">Panitia belum menjadwalkan ujian.</CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-4">
                            {exam.sections.map((s, i) => {
                                const meta = pillarMeta[s.pillar];
                                return (
                                    <div key={s.pillar} className="bg-card rounded-xl border p-4">
                                        <div className="flex items-center justify-between">
                                            <meta.icon className={cn('size-5', meta.text)} />
                                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                                <Clock className="size-3.5" /> {s.minutes} mnt
                                            </span>
                                        </div>
                                        <p className="mt-3 font-medium">
                                            {i + 1}. {s.label}
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{s.description}</p>
                                    </div>
                                );
                            })}
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tata tertib</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3 text-sm">
                                    {rules.map((rule) => (
                                        <li key={rule} className="flex gap-3">
                                            <CircleCheck className="text-primary mt-0.5 size-4 shrink-0" />
                                            <span>{rule}</span>
                                        </li>
                                    ))}
                                    <li className="flex gap-3">
                                        <CircleCheck className="text-primary mt-0.5 size-4 shrink-0" />
                                        <span>Ada jeda {exam.break_minutes} menit di antara pilar. Jeda boleh dilewati.</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {exam.is_open ? (
                            <div className="bg-card flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
                                {hasActiveAttempt ? (
                                    <p className="text-sm">Ujianmu sedang berlangsung. Waktu terus berjalan.</p>
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                                        <Label htmlFor="agree" className="leading-relaxed font-normal">
                                            Saya sudah membaca tata tertib dan siap memulai. Waktu pilar pertama langsung berjalan.
                                        </Label>
                                    </div>
                                )}
                                <Button size="lg" onClick={start} disabled={!agreed || starting} className="shrink-0">
                                    {starting && <LoaderCircle className="animate-spin" />}
                                    {hasActiveAttempt ? 'Lanjutkan ujian' : 'Mulai ujian'}
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-muted/40 text-muted-foreground flex items-center gap-3 rounded-xl border p-5 text-sm">
                                <Lock className="size-5 shrink-0" />
                                Ujian belum dibuka{exam.scheduled_at ? `. Jadwal: ${formatDateTime(exam.scheduled_at)}` : ''}. Halaman ini akan bisa dipakai saat panitia membuka
                                ujian.
                            </div>
                        )}
                    </>
                )}
            </div>
        </PublicLayout>
    );
}
