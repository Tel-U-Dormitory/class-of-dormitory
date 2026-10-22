import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { type Pillar } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowRight, Calculator, Eye, EyeOff, LoaderCircle, Lock, MonitorPlay, Play, Trash2, Trophy } from 'lucide-react';

interface Section {
    id: number;
    pillar: Pillar;
    label: string;
    position: number;
    minutes: number;
    instructions: string | null;
    question_count: number;
}

interface Props {
    exam: {
        id: number;
        title: string;
        description: string | null;
        status: 'draft' | 'open' | 'closed';
        scheduled_at: string | null;
        break_minutes: number;
        announcement: string | null;
        results_published: boolean;
        has_attempts: boolean;
        submitted_count: number;
        question_bank_locked: boolean;
        sections: Section[];
    };
}

const statusLabels = { draft: 'Draf', open: 'Dibuka', closed: 'Ditutup' };

export default function ExamEdit({ exam }: Props) {
    const form = useForm({
        title: exam.title,
        description: exam.description ?? '',
        scheduled_at: exam.scheduled_at ?? '',
        break_minutes: exam.break_minutes,
        announcement: exam.announcement ?? '',
        sections: exam.sections.map((s) => ({ id: s.id, minutes: s.minutes, instructions: s.instructions ?? '' })),
    });

    const errors = form.errors as Record<string, string | undefined>;
    const totalQuestions = exam.sections.reduce((sum, s) => sum + s.question_count, 0);

    const setStatus = (status: string) => {
        const message =
            status === 'open'
                ? 'Buka ujian? Peserta dapat langsung memulai, dan ujian lain yang sedang dibuka akan ditutup.'
                : status === 'closed'
                  ? 'Tutup ujian? Peserta baru tidak bisa memulai. Peserta yang sedang mengerjakan tetap bisa menyelesaikan sampai waktunya habis.'
                  : 'Kembalikan ke draf?';
        if (confirm(message)) router.patch(route('admin.exams.status', exam.id), { status }, { preserveScroll: true });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Ujian & Bank Soal', href: '/admin/ujian' },
                { title: exam.title, href: route('admin.exams.edit', exam.id) },
            ]}
        >
            <Head title={exam.title} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={exam.title}
                    description={
                        <span className="flex items-center gap-2">
                            <StatusBadge status={exam.status} label={statusLabels[exam.status]} /> {totalQuestions} soal aktif
                        </span>
                    }
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link href={route('admin.exams.monitor', exam.id)}>
                                    <MonitorPlay /> Monitor
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={route('admin.exams.results', exam.id)}>
                                    <Trophy /> Hasil
                                </Link>
                            </Button>
                            {exam.status === 'open' ? (
                                <Button variant="destructive" onClick={() => setStatus('closed')}>
                                    <Lock /> Tutup ujian
                                </Button>
                            ) : (
                                <Button onClick={() => setStatus('open')} disabled={totalQuestions === 0}>
                                    <Play /> Buka ujian
                                </Button>
                            )}
                        </>
                    }
                />

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-base">Bank soal per pilar</CardTitle>
                            <CardDescription>
                                Urutan pilar tetap: Memory → Spatial → Numeric → Logic.
                                {exam.question_bank_locked && ' Bank soal terkunci selama ujian berjalan.'}
                            </CardDescription>
                        </div>
                        {exam.submitted_count > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={exam.question_bank_locked}
                                onClick={() =>
                                    confirm(`Nilai ulang ${exam.submitted_count} peserta berdasarkan kunci jawaban saat ini?`) &&
                                    router.post(route('admin.exams.rescore', exam.id), {}, { preserveScroll: true })
                                }
                            >
                                <Calculator /> Hitung ulang nilai
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {exam.sections.map((s) => {
                            const meta = pillarMeta[s.pillar];
                            return (
                                <Link
                                    key={s.id}
                                    href={route('admin.sections.show', s.id)}
                                    className="hover:border-foreground/30 group flex flex-col rounded-lg border p-4 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <meta.icon className={cn('size-5', meta.text)} />
                                        <ArrowRight className="text-muted-foreground size-4 transition group-hover:translate-x-0.5" />
                                    </div>
                                    <p className="mt-3 font-medium">
                                        {s.position}. {s.label}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {s.question_count} soal · {s.minutes} menit
                                    </p>
                                </Link>
                            );
                        })}
                    </CardContent>
                </Card>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(route('admin.exams.update', exam.id), { preserveScroll: true });
                    }}
                    className="grid gap-6 xl:grid-cols-2"
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Informasi ujian</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Judul</Label>
                                <Input id="title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} />
                                <InputError message={form.errors.title} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea id="description" value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="scheduled_at">Jadwal (informasi)</Label>
                                    <Input id="scheduled_at" type="datetime-local" value={form.data.scheduled_at} onChange={(e) => form.setData('scheduled_at', e.target.value)} />
                                    <InputError message={form.errors.scheduled_at} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="break_minutes">Jeda antar pilar (menit)</Label>
                                    <Input
                                        id="break_minutes"
                                        type="number"
                                        min={0}
                                        value={form.data.break_minutes}
                                        onChange={(e) => form.setData('break_minutes', Number(e.target.value))}
                                    />
                                    <InputError message={form.errors.break_minutes} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="announcement">Pengumuman untuk peserta</Label>
                                <Textarea id="announcement" value={form.data.announcement} onChange={(e) => form.setData('announcement', e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Durasi & instruksi pilar</CardTitle>
                            {exam.has_attempts && <CardDescription>Ujian sudah dikerjakan. Perubahan durasi hanya berlaku untuk pilar yang belum dimulai peserta.</CardDescription>}
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            {exam.sections.map((s, i) => (
                                <div key={s.id} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:gap-4">
                                    <div className="grid content-start gap-2">
                                        <Label htmlFor={`minutes-${s.id}`}>{s.label} (menit)</Label>
                                        <Input
                                            id={`minutes-${s.id}`}
                                            type="number"
                                            min={1}
                                            value={form.data.sections[i].minutes}
                                            onChange={(e) =>
                                                form.setData(
                                                    'sections',
                                                    form.data.sections.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)),
                                                )
                                            }
                                        />
                                        <InputError message={errors[`sections.${i}.minutes`]} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor={`instructions-${s.id}`}>Instruksi</Label>
                                        <Textarea
                                            id={`instructions-${s.id}`}
                                            rows={2}
                                            placeholder="Opsional, tampil di soal pertama pilar ini."
                                            value={form.data.sections[i].instructions}
                                            onChange={(e) =>
                                                form.setData(
                                                    'sections',
                                                    form.data.sections.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)),
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center justify-between gap-3 xl:col-span-2">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => router.patch(route('admin.exams.publish', exam.id), {}, { preserveScroll: true })}>
                                {exam.results_published ? <EyeOff /> : <Eye />}
                                {exam.results_published ? 'Tarik publikasi hasil' : 'Publikasikan hasil ke peserta'}
                            </Button>
                            {!exam.has_attempts && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => confirm('Hapus ujian beserta seluruh soalnya?') && router.delete(route('admin.exams.destroy', exam.id))}
                                >
                                    <Trash2 /> Hapus ujian
                                </Button>
                            )}
                        </div>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <LoaderCircle className="animate-spin" />}
                            Simpan pengaturan
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
