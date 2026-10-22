import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Activity, CheckCircle2, MonitorPlay, Trophy, Users, Eye } from 'lucide-react';

interface Props {
    exam: { id: number; title: string; status: string; status_label: string; scheduled_at: string | null; question_count: number } | null;
    stats: { participants: number; in_progress: number; submitted: number; tab_switches: number };
    registration: { open: boolean; closed_message: string };
    statusBreakdown: { label: string; value: string; total: number }[];
    buildings: { name: string; total: number }[];
    recentParticipants: { id: number; full_name: string; nim: string; building: string; created_at: string }[];
}

export default function Dashboard({ exam, stats, registration, statusBreakdown, buildings, recentParticipants }: Props) {
    const maxBuilding = Math.max(1, ...buildings.map((b) => b.total));
    const { auth } = usePage<SharedData>().props;
    const [message, setMessage] = useState(registration.closed_message);

    const toggleRegistration = () => {
        const open = !registration.open;
        if (confirm(open ? 'Buka pendaftaran peserta?' : 'Tutup pendaftaran? Calon peserta tidak bisa mendaftar lagi.')) {
            router.put(route('admin.registration.update'), { open, closed_message: message }, { preserveScroll: true });
        }
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/admin' }]}>
            <Head title="Dashboard" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Dashboard"
                    description={
                        exam ? (
                            <span className="flex flex-wrap items-center gap-2">
                                {exam.title} <StatusBadge status={exam.status} label={exam.status_label} /> · {exam.question_count} soal aktif
                                {exam.scheduled_at && ` · ${formatDateTime(exam.scheduled_at)}`}
                            </span>
                        ) : (
                            'Belum ada ujian. Buat ujian di menu Ujian & Bank Soal.'
                        )
                    }
                    actions={
                        exam && (
                            <>
                                <Button asChild variant="outline">
                                    <Link href={route('admin.exams.results', exam.id)}>
                                        <Trophy /> Hasil
                                    </Link>
                                </Button>
                                <Button asChild>
                                    <Link href={route('admin.exams.monitor', exam.id)}>
                                        <MonitorPlay /> Monitor live
                                    </Link>
                                </Button>
                            </>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Peserta terdaftar" value={stats.participants} icon={Users} />
                    <StatCard label="Sedang ujian" value={stats.in_progress} icon={Activity} hint="Termasuk yang sedang jeda" />
                    <StatCard label="Selesai ujian" value={stats.submitted} icon={CheckCircle2} />
                    <StatCard label="Total pindah tab" value={stats.tab_switches} icon={Eye} hint="Akumulasi seluruh peserta" />
                </div>

                {auth.user?.role === 'admin' && (
                    <Card className={registration.open ? '' : 'border-amber-500/40'}>
                        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="flex items-center gap-3">
                                <span className={`size-2.5 rounded-full ${registration.open ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <div>
                                    <p className="font-medium">Pendaftaran {registration.open ? 'dibuka' : 'ditutup'}</p>
                                    <p className="text-muted-foreground text-sm">
                                        {registration.open ? 'Calon peserta bisa mendaftar dari situs.' : 'Tombol daftar disembunyikan dan formulir menolak pendaftaran baru.'}
                                    </p>
                                </div>
                            </div>
                            <Input
                                aria-label="Pesan saat pendaftaran ditutup"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="lg:ml-auto lg:max-w-md"
                            />
                            <Button variant={registration.open ? 'outline' : 'default'} onClick={toggleRegistration} className="shrink-0">
                                {registration.open ? 'Tutup pendaftaran' : 'Buka pendaftaran'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Pendaftar per gedung</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                            {buildings.map((b) => (
                                <div key={b.name} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                                    <span className="text-muted-foreground truncate">{b.name}</span>
                                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                                        <div className="bg-primary h-full rounded-full" style={{ width: `${(b.total / maxBuilding) * 100}%` }} />
                                    </div>
                                    <span className="text-right tabular-nums">{b.total}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Status peserta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {statusBreakdown.map((s) => (
                                <div key={s.value} className="flex items-center justify-between text-sm">
                                    <StatusBadge status={s.value} label={s.label} />
                                    <span className="tabular-nums">{s.total}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-semibold">Pendaftar terbaru</h2>
                        <Button asChild variant="link" className="px-0">
                            <Link href={route('admin.participants.index')}>Lihat semua</Link>
                        </Button>
                    </div>
                    <DataTable>
                        <thead>
                            <tr>
                                <Th>Nama</Th>
                                <Th>NIM</Th>
                                <Th>Gedung</Th>
                                <Th>Waktu daftar</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentParticipants.length === 0 && <EmptyRow colSpan={4}>Belum ada pendaftar.</EmptyRow>}
                            {recentParticipants.map((p) => (
                                <Tr key={p.id}>
                                    <Td>
                                        <Link href={route('admin.participants.show', p.id)} className="font-medium hover:underline">
                                            {p.full_name}
                                        </Link>
                                    </Td>
                                    <Td className="tabular-nums">{p.nim}</Td>
                                    <Td>{p.building}</Td>
                                    <Td className="text-muted-foreground">{formatDateTime(p.created_at)}</Td>
                                </Tr>
                            ))}
                        </tbody>
                    </DataTable>
                </div>
            </div>
        </AppLayout>
    );
}
