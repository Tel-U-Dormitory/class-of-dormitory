import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { Head, Link, useForm } from '@inertiajs/react';
import { MonitorPlay, Plus, Settings2, Trophy } from 'lucide-react';

interface Props {
    exams: { id: number; title: string; status: string; status_label: string; scheduled_at: string | null; attempts_count: number; total_minutes: number }[];
}

export default function ExamsIndex({ exams }: Props) {
    const form = useForm({ title: '' });

    return (
        <AppLayout breadcrumbs={[{ title: 'Ujian & Bank Soal', href: '/admin/ujian' }]}>
            <Head title="Ujian" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Ujian & Bank Soal"
                    description="Kelola jadwal, durasi pilar, dan soal. Hanya satu ujian yang dapat dibuka pada satu waktu."
                    actions={
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus /> Ujian baru
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        form.post(route('admin.exams.store'));
                                    }}
                                    className="space-y-4"
                                >
                                    <DialogHeader>
                                        <DialogTitle>Ujian baru</DialogTitle>
                                        <DialogDescription>Ujian dibuat sebagai draf dengan 4 pilar (30 menit per pilar). Semuanya bisa diubah nanti.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">Judul</Label>
                                        <Input id="title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="Seleksi Massal Season 3" />
                                        <InputError message={form.errors.title} />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={form.processing}>
                                            Buat ujian
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    }
                />

                <DataTable>
                    <thead>
                        <tr>
                            <Th>Judul</Th>
                            <Th>Status</Th>
                            <Th>Jadwal</Th>
                            <Th className="text-right">Durasi</Th>
                            <Th className="text-right">Peserta mengerjakan</Th>
                            <Th />
                        </tr>
                    </thead>
                    <tbody>
                        {exams.length === 0 && <EmptyRow colSpan={6}>Belum ada ujian.</EmptyRow>}
                        {exams.map((exam) => (
                            <Tr key={exam.id}>
                                <Td>
                                    <Link href={route('admin.exams.edit', exam.id)} className="font-medium hover:underline">
                                        {exam.title}
                                    </Link>
                                </Td>
                                <Td>
                                    <StatusBadge status={exam.status} label={exam.status_label} />
                                </Td>
                                <Td className="text-muted-foreground">{formatDateTime(exam.scheduled_at)}</Td>
                                <Td className="text-right tabular-nums">{exam.total_minutes} mnt</Td>
                                <Td className="text-right tabular-nums">{exam.attempts_count}</Td>
                                <Td className="text-right whitespace-nowrap">
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href={route('admin.exams.edit', exam.id)}>
                                            <Settings2 /> Kelola
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href={route('admin.exams.monitor', exam.id)}>
                                            <MonitorPlay /> Monitor
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href={route('admin.exams.results', exam.id)}>
                                            <Trophy /> Hasil
                                        </Link>
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </DataTable>
            </div>
        </AppLayout>
    );
}
