import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PublicLayout from '@/layouts/public-layout';
import { formatDateTime } from '@/lib/format';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { type Pillar } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Megaphone, UserRound } from 'lucide-react';

interface Props {
    participant: {
        full_name: string;
        nim: string;
        building: string;
        room_number: string;
        major: string;
        status: string;
        status_label: string;
        photo_url: string | null;
    };
    exam: {
        title: string;
        description: string | null;
        status: string;
        scheduled_at: string | null;
        announcement: string | null;
        total_minutes: number;
        sections: { pillar: Pillar; label: string; minutes: number }[];
    } | null;
    attempt: { status: string; submitted_at: string | null; result: { score_total: number; sections: { label: string; score: number }[] } | null } | null;
    resultsPublished: boolean;
}

export default function ParticipantDashboard({ participant, exam, attempt }: Props) {
    const examAction = (() => {
        if (!exam) return null;
        if (attempt?.status === 'submitted') return { label: 'Lihat ringkasan', href: route('exam.finished') };
        if (attempt) return { label: 'Lanjutkan ujian', href: route('exam.session') };
        return { label: exam.status === 'open' ? 'Masuk ruang ujian' : 'Lihat ruang ujian', href: route('exam.lobby') };
    })();

    return (
        <PublicLayout className="px-4 py-10 sm:px-6">
            <Head title="Beranda Peserta" />

            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[18rem_1fr]">
                <Card className="h-fit">
                    <CardContent className="flex flex-col items-center text-center">
                        {participant.photo_url ? (
                            <img src={participant.photo_url} alt="" className="size-24 rounded-full border object-cover" />
                        ) : (
                            <div className="bg-muted flex size-24 items-center justify-center rounded-full">
                                <UserRound className="text-muted-foreground size-10" />
                            </div>
                        )}
                        <h1 className="mt-4 text-lg font-semibold">{participant.full_name}</h1>
                        <p className="text-muted-foreground text-sm">{participant.nim}</p>
                        <StatusBadge status={participant.status} label={participant.status_label} className="mt-3" />
                        <dl className="mt-6 grid w-full gap-3 text-left text-sm">
                            {[
                                ['Gedung', participant.building],
                                ['Kamar', participant.room_number],
                                ['Prodi', participant.major],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="text-right font-medium">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {exam?.announcement && (
                        <div className="border-gold/40 bg-gold/10 flex gap-3 rounded-xl border p-4 text-sm">
                            <Megaphone className="text-gold mt-0.5 size-5 shrink-0" />
                            <p>{exam.announcement}</p>
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>{exam ? exam.title : 'Belum ada ujian'}</CardTitle>
                            <CardDescription>
                                {exam
                                    ? `${exam.scheduled_at ? formatDateTime(exam.scheduled_at) + ' · ' : ''}${exam.total_minutes} menit`
                                    : 'Panitia belum menjadwalkan ujian. Cek kembali nanti.'}
                            </CardDescription>
                        </CardHeader>
                        {exam && (
                            <CardContent className="space-y-6">
                                <div className="grid gap-3 sm:grid-cols-4">
                                    {exam.sections.map((s) => {
                                        const meta = pillarMeta[s.pillar];
                                        return (
                                            <div key={s.pillar} className="bg-muted/40 rounded-lg border p-3">
                                                <meta.icon className={cn('size-5', meta.text)} />
                                                <p className="mt-2 text-sm font-medium">{s.label}</p>
                                                <p className="text-muted-foreground text-xs">{s.minutes} menit</p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {attempt?.result && (
                                    <div className="rounded-lg border p-4">
                                        <p className="text-muted-foreground text-sm">Skor total</p>
                                        <p className="text-3xl font-semibold tabular-nums">{attempt.result.score_total}</p>
                                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                                            {attempt.result.sections.map((s) => (
                                                <span key={s.label}>
                                                    {s.label}: <strong className="tabular-nums">{s.score}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {examAction && (
                                    <Button asChild size="lg">
                                        <Link href={examAction.href}>
                                            {examAction.label} <ArrowRight />
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        )}
                    </Card>
                </div>
            </div>
        </PublicLayout>
    );
}
