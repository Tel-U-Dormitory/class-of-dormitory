import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/layouts/public-layout';
import { formatDateTime } from '@/lib/format';
import { Head, Link } from '@inertiajs/react';
import { PartyPopper } from 'lucide-react';

interface Props {
    exam: { title: string };
    submittedAt: string;
    submitReason: string | null;
    answeredCount: number;
    result: { score_total: number; sections: { label: string; score: number }[] } | null;
}

export default function Finished({ exam, submittedAt, submitReason, answeredCount, result }: Props) {
    return (
        <PublicLayout className="px-4 py-14 sm:py-20">
            <Head title="Ujian Selesai" />

            <div className="mx-auto max-w-lg text-center">
                <div className="bg-primary/15 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                    <PartyPopper className="size-7" />
                </div>
                <h1 className="font-display mt-6 text-2xl font-bold">Ujian selesai</h1>
                <p className="text-muted-foreground mt-2">
                    {exam.title} · {formatDateTime(submittedAt)}
                    {submitReason ? ` · ${submitReason}` : ''}
                </p>

                <Card className="mt-8 text-left">
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Soal terjawab</span>
                            <span className="font-medium tabular-nums">{answeredCount}</span>
                        </div>
                        {result ? (
                            <>
                                <div className="flex items-end justify-between border-t pt-4">
                                    <span className="text-muted-foreground text-sm">Skor total</span>
                                    <span className="text-3xl font-semibold tabular-nums">{result.score_total}</span>
                                </div>
                                {result.sections.map((s) => (
                                    <div key={s.label} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{s.label}</span>
                                        <span className="tabular-nums">{s.score}</span>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <p className="text-muted-foreground border-t pt-4 text-sm">Hasil dan peringkat akan diumumkan panitia setelah seluruh peserta selesai.</p>
                        )}
                    </CardContent>
                </Card>

                <Button asChild variant="outline" className="mt-8">
                    <Link href={route('participant.dashboard')}>Kembali ke beranda peserta</Link>
                </Button>
            </div>
        </PublicLayout>
    );
}
