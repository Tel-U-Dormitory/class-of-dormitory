import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { type Option, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { KeyRound, Trash2, UserRound } from 'lucide-react';

interface Props {
    participant: {
        id: number;
        full_name: string;
        nim: string;
        email: string | null;
        building: string;
        room_number: string;
        major: string;
        achievements: string[];
        status: string;
        status_label: string;
        photo_url: string | null;
        token_issued_at: string | null;
        last_login_at: string | null;
        created_at: string;
    };
    attempts: {
        id: number;
        exam: string;
        status: string;
        status_label: string;
        started_at: string;
        submitted_at: string | null;
        submit_reason: string | null;
        score_total: number | null;
        tab_switch_count: number;
        sections: { label: string; score: number | null; correct: number | null; wrong: number | null }[];
    }[];
    statuses: Option[];
    newToken: string | null;
}

export default function ParticipantShow({ participant, attempts, statuses, newToken }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';

    const details: [string, React.ReactNode][] = [
        ['NIM', participant.nim],
        ['Email', participant.email ?? '—'],
        ['Gedung', `${participant.building} · kamar ${participant.room_number}`],
        ['Prodi', participant.major],
        ['Terdaftar', formatDateTime(participant.created_at)],
        ['Login terakhir', formatDateTime(participant.last_login_at)],
        ['Token dibuat', formatDateTime(participant.token_issued_at)],
    ];

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Peserta', href: '/admin/peserta' },
                { title: participant.full_name, href: route('admin.participants.show', participant.id) },
            ]}
        >
            <Head title={participant.full_name} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={participant.full_name}
                    description={<StatusBadge status={participant.status} label={participant.status_label} />}
                    actions={
                        isAdmin && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        confirm('Buat token baru? Token lama langsung tidak berlaku dan peserta akan keluar dari sesinya.') &&
                                        router.post(route('admin.participants.reset-token', participant.id), {}, { preserveScroll: true })
                                    }
                                >
                                    <KeyRound /> Reset token
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() =>
                                        confirm(`Hapus ${participant.full_name} beserta seluruh data ujiannya? Tindakan ini tidak bisa dibatalkan.`) &&
                                        router.delete(route('admin.participants.destroy', participant.id))
                                    }
                                >
                                    <Trash2 /> Hapus
                                </Button>
                            </>
                        )
                    }
                />

                {newToken && (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm">Token baru untuk peserta (hanya ditampilkan sekali):</p>
                        <p className="font-mono text-2xl font-bold tracking-[0.2em] select-all">{newToken}</p>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
                    <Card>
                        <CardContent className="space-y-5">
                            {participant.photo_url ? (
                                <img src={participant.photo_url} alt={`Foto ${participant.full_name}`} className="aspect-[3/4] w-full rounded-lg border object-cover" />
                            ) : (
                                <div className="bg-muted flex aspect-[3/4] items-center justify-center rounded-lg">
                                    <UserRound className="text-muted-foreground size-12" />
                                </div>
                            )}
                            <dl className="space-y-2.5 text-sm">
                                {details.map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-3">
                                        <dt className="text-muted-foreground shrink-0">{k}</dt>
                                        <dd className="text-right">{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            {isAdmin && (
                                <div className="grid gap-2">
                                    <label htmlFor="status" className="text-muted-foreground text-sm">
                                        Ubah status
                                    </label>
                                    <NativeSelect
                                        id="status"
                                        value={participant.status}
                                        onChange={(e) => {
                                            const status = e.target.value;
                                            const warn = status === 'disqualified' ? ' Ujian yang sedang berjalan akan langsung dihentikan.' : '';
                                            if (confirm(`Ubah status menjadi "${statuses.find((s) => s.value === status)?.label}"?${warn}`)) {
                                                router.patch(route('admin.participants.status', participant.id), { status }, { preserveScroll: true });
                                            }
                                        }}
                                    >
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Prestasi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {participant.achievements.length ? (
                                    <ul className="list-disc space-y-1 pl-5 text-sm">
                                        {participant.achievements.map((a) => (
                                            <li key={a}>{a}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Tidak ada.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Riwayat ujian</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {attempts.length === 0 && <p className="text-muted-foreground text-sm">Belum pernah mengerjakan ujian.</p>}
                                {attempts.map((a) => (
                                    <div key={a.id} className="rounded-lg border p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-medium">{a.exam}</p>
                                            <StatusBadge status={a.status} label={a.status_label} />
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            Mulai {formatDateTime(a.started_at)}
                                            {a.submitted_at && ` · selesai ${formatDateTime(a.submitted_at)}`}
                                            {a.submit_reason && ` · ${a.submit_reason}`} · pindah tab {a.tab_switch_count}×
                                        </p>
                                        {a.score_total !== null && (
                                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                                {a.sections.map((s) => (
                                                    <div key={s.label} className="bg-muted/40 rounded-md p-2 text-center">
                                                        <p className="text-muted-foreground text-xs">{s.label}</p>
                                                        <p className="font-semibold tabular-nums">{s.score ?? 0}</p>
                                                        <p className="text-muted-foreground text-[0.7rem]">
                                                            {s.correct ?? 0} benar · {s.wrong ?? 0} salah
                                                        </p>
                                                    </div>
                                                ))}
                                                <div className="bg-primary/10 rounded-md p-2 text-center">
                                                    <p className="text-muted-foreground text-xs">Total</p>
                                                    <p className="text-lg font-semibold tabular-nums">{a.score_total}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
