import { ChallengeFormFields, type ChallengeFormData } from '@/components/admin/challenge-form';
import { type ChallengeSummary, type GameTypeOption } from '@/components/admin/challenge-types';
import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useServerClock } from '@/hooks/use-server-clock';
import AppLayout from '@/layouts/app-layout';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, router, useForm, usePoll } from '@inertiajs/react';
import { Check, ExternalLink, Eye, EyeOff, Lock, Play, Plus, RotateCcw, Search, Square, Trash2, Trophy, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface LeaderRow {
    id: number;
    name: string;
    subtitle: string;
    attempts: number;
    best_ms: number | null;
    rank: number | null;
}

interface Candidate {
    id: number;
    full_name: string;
    nim: string;
    building: string;
    status: string;
    status_label: string;
}

interface Props {
    challenge: ChallengeSummary & { answer_key: string; description: string | null; opened_at: number | null; processed_at: string | null; has_invites: boolean };
    leaderboard: LeaderRow[];
    recentSubmissions: { id: number; entrant: string | null; answer: string; is_correct: boolean; elapsed_ms: number }[];
    teams: { id: number; name: string; member_ids: number[]; members: string[] }[];
    rosterIds: number[];
    candidates: Candidate[];
    gameTypes: GameTypeOption[];
    serverNow: number;
}

function formatMs(ms: number | null) {
    if (ms == null) return '—';
    return `${formatClock(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}`;
}

export default function ChallengeShow(props: Props) {
    const { challenge } = props;
    const [tab, setTab] = useState<'board' | 'roster' | 'settings'>('board');
    usePoll(challenge.status === 'active' ? 3000 : 15000, { only: ['leaderboard', 'recentSubmissions', 'challenge', 'serverNow'] });

    const setStatus = (status: string) => router.patch(route('admin.challenges.status', challenge.code), { status }, { preserveScroll: true });

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Challenge & Game', href: '/admin/challenge' },
                { title: challenge.title, href: route('admin.challenges.show', challenge.code) },
            ]}
        >
            <Head title={challenge.title} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={challenge.title}
                    description={
                        <span className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={challenge.status === 'active' ? 'open' : challenge.status === 'ended' ? 'closed' : 'draft'} label={challenge.status_label} />
                            Chapter {challenge.chapter} · {challenge.game_type_label} · {challenge.competition_mode === 'team' ? 'Kelompok' : 'Individu'}
                            {challenge.is_deathmatch && ' · Deathmatch'}
                        </span>
                    }
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <a href={challenge.arena_url} target="_blank" rel="noreferrer">
                                    <ExternalLink /> Buka kiosk
                                </a>
                            </Button>
                            {challenge.status === 'active' ? (
                                <>
                                    <Button variant="outline" onClick={() => setStatus('locked')}>
                                        <Square /> Kunci sementara
                                    </Button>
                                    <Button variant="destructive" onClick={() => setStatus('ended')}>
                                        <Lock /> Tutup game
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => setStatus('active')}>
                                    <Play /> {challenge.opened_at ? 'Lanjutkan game' : 'Buka game'}
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="flex gap-1 border-b">
                    {(
                        [
                            ['board', 'Papan peringkat'],
                            ['roster', challenge.competition_mode === 'team' ? 'Kelompok' : 'Roster peserta'],
                            ['settings', 'Pengaturan'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={cn(
                                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
                                tab === key ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'board' && <Board {...props} />}
                {tab === 'roster' && (challenge.competition_mode === 'team' ? <Teams {...props} /> : <Roster {...props} />)}
                {tab === 'settings' && <Settings {...props} />}
            </div>
        </AppLayout>
    );
}

function Board({ challenge, leaderboard, recentSubmissions, serverNow }: Props) {
    const now = useServerClock(serverNow, 100);
    const elapsed = challenge.opened_at ? now - challenge.opened_at : null;
    const form = useForm({ max_winners: challenge.max_winners, failed_status: challenge.is_deathmatch ? 'eliminated' : 'deathmatch' });
    const ranked = leaderboard.filter((r) => r.rank !== null).length;

    return (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                    <div>
                        <p className="text-muted-foreground text-xs">Waktu berjalan sejak dibuka</p>
                        <p className="font-mono text-3xl font-semibold tabular-nums">{elapsed !== null ? formatClock(elapsed / 1000) : '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Sudah benar</p>
                        <p className="text-3xl font-semibold tabular-nums">
                            {ranked}
                            <span className="text-muted-foreground text-lg">/{leaderboard.length}</span>
                        </p>
                    </div>
                </div>

                <DataTable>
                    <thead>
                        <tr>
                            <Th className="w-12 text-right">#</Th>
                            <Th>{challenge.competition_mode === 'team' ? 'Kelompok' : 'Peserta'}</Th>
                            <Th className="text-right">Waktu benar</Th>
                            <Th className="text-right">Percobaan</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.length === 0 && <EmptyRow colSpan={4}>Roster kosong. Atur peserta atau kelompok di tab roster.</EmptyRow>}
                        {leaderboard.map((row) => {
                            const winner = row.rank !== null && row.rank <= challenge.max_winners;
                            return (
                                <Tr key={row.id} className={cn(winner && 'bg-emerald-500/5')}>
                                    <Td className="text-right font-semibold tabular-nums">
                                        {row.rank !== null ? (
                                            <span className={cn(winner && 'text-emerald-600 dark:text-emerald-400')}>{row.rank}</span>
                                        ) : (
                                            <span className="text-muted-foreground">–</span>
                                        )}
                                    </Td>
                                    <Td>
                                        <p className="font-medium">{row.name}</p>
                                        <p className="text-muted-foreground truncate text-xs">{row.subtitle}</p>
                                    </Td>
                                    <Td className="text-right font-mono tabular-nums">{formatMs(row.best_ms)}</Td>
                                    <Td className="text-muted-foreground text-right tabular-nums">{row.attempts}</Td>
                                </Tr>
                            );
                        })}
                    </tbody>
                </DataTable>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Trophy className="size-4" /> Proses bracket
                        </CardTitle>
                        <CardDescription>
                            N tercepat yang benar menjadi <strong>Lolos babak</strong>; sisa roster dipindah sesuai pilihan.
                            {challenge.processed_at && ' Bracket game ini sudah pernah diproses.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (confirm(`Proses bracket? ${form.data.max_winners} tercepat lolos, sisa roster menjadi ${form.data.failed_status === 'deathmatch' ? 'Deathmatch' : 'Tereliminasi'}.`)) {
                                    form.post(route('admin.challenges.bracket', challenge.code), { preserveScroll: true });
                                }
                            }}
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="b-winners">Kuota lolos</Label>
                                <Input id="b-winners" type="number" min={1} value={form.data.max_winners} onChange={(e) => form.setData('max_winners', Number(e.target.value))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="b-failed">Sisa peserta menjadi</Label>
                                <NativeSelect id="b-failed" value={form.data.failed_status} onChange={(e) => form.setData('failed_status', e.target.value)}>
                                    <option value="deathmatch">Deathmatch</option>
                                    <option value="eliminated">Tereliminasi</option>
                                </NativeSelect>
                            </div>
                            <Button type="submit" disabled={form.processing || challenge.status === 'active'}>
                                Proses bracket
                            </Button>
                            {challenge.status === 'active' && <p className="text-muted-foreground text-xs">Tutup game terlebih dahulu sebelum memproses bracket.</p>}
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Jawaban terbaru</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentSubmissions.length === 0 && <p className="text-muted-foreground text-sm">Belum ada jawaban.</p>}
                        {recentSubmissions.map((s) => (
                            <div key={s.id} className="flex items-start gap-2 text-sm">
                                {s.is_correct ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <X className="text-destructive mt-0.5 size-4 shrink-0" />}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{s.entrant}</p>
                                    <p className="text-muted-foreground truncate font-mono text-xs">{s.answer}</p>
                                </div>
                                <span className="text-muted-foreground font-mono text-xs tabular-nums">{formatMs(s.elapsed_ms)}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function useCandidateFilter(candidates: Candidate[]) {
    const [search, setSearch] = useState('');
    const [building, setBuilding] = useState('');
    const buildings = useMemo(() => [...new Set(candidates.map((c) => c.building))], [candidates]);
    const visible = candidates.filter(
        (c) => (!building || c.building === building) && (!search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.nim.includes(search)),
    );

    const controls = (
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input className="pl-9" placeholder="Cari nama atau NIM" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <NativeSelect aria-label="Gedung" value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option value="">Semua gedung</option>
                {buildings.map((b) => (
                    <option key={b}>{b}</option>
                ))}
            </NativeSelect>
        </div>
    );

    return { visible, controls };
}

function CandidateGrid({ candidates, selected, onToggle }: { candidates: Candidate[]; selected: Set<number>; onToggle: (id: number) => void }) {
    return (
        <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {candidates.map((c) => (
                <label key={c.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', selected.has(c.id) && 'border-primary/60 bg-primary/5')}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggle(c.id)} className="mt-0.5" />
                    <span className="min-w-0">
                        <span className="block truncate font-medium">{c.full_name}</span>
                        <span className="text-muted-foreground text-xs">
                            {c.building} · {c.status_label}
                        </span>
                    </span>
                </label>
            ))}
            {candidates.length === 0 && <p className="text-muted-foreground text-sm">Tidak ada peserta yang cocok.</p>}
        </div>
    );
}

function Roster({ challenge, rosterIds, candidates }: Props) {
    const [selected, setSelected] = useState<Set<number>>(() => new Set(challenge.has_invites ? rosterIds : []));
    const { visible, controls } = useCandidateFilter(candidates);
    const toggle = (id: number) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

    const save = (mode: 'individual' | 'team') =>
        router.put(route('admin.challenges.roster', challenge.code), { competition_mode: mode, participant_ids: mode === 'team' ? [] : [...selected] }, { preserveScroll: true });

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-base">Roster individu</CardTitle>
                    <CardDescription className="mt-1 max-w-2xl">
                        Jika tidak ada yang dicentang, roster otomatis berisi peserta yang masih bertanding
                        {challenge.is_deathmatch ? ' berstatus Deathmatch' : ' (Cast, Lolos babak, Deathmatch)'}. Saat ini {rosterIds.length} peserta di roster.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => confirm('Ubah game ini ke mode kelompok?') && save('team')}>
                        Ubah ke mode kelompok
                    </Button>
                    <Button onClick={() => save('individual')}>Simpan roster ({selected.size})</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {controls}
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set([...selected, ...visible.map((c) => c.id)]))}>
                        Centang yang tampil
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                        Kosongkan (pakai aturan otomatis)
                    </Button>
                </div>
                <CandidateGrid candidates={visible} selected={selected} onToggle={toggle} />
            </CardContent>
        </Card>
    );
}

function Teams({ challenge, teams, candidates }: Props) {
    const [editing, setEditing] = useState<{ id: number | null; name: string; members: Set<number> } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { visible, controls } = useCandidateFilter(candidates);
    const takenElsewhere = new Set(teams.filter((t) => t.id !== editing?.id).flatMap((t) => t.member_ids));

    const save = () => {
        if (!editing) return;
        const payload = { name: editing.name, member_ids: [...editing.members] };
        const options = { preserveScroll: true, onSuccess: () => setEditing(null), onError: setErrors };
        if (editing.id) router.put(route('admin.teams.update', editing.id), payload, options);
        else router.post(route('admin.teams.store', challenge.code), payload, options);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-base">Kelompok</CardTitle>
                    <CardDescription>Di kiosk, peserta memilih nama kelompok. Jika kelompok lolos, seluruh anggotanya ikut lolos.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() =>
                            confirm('Ubah game ini ke mode individu?') &&
                            router.put(route('admin.challenges.roster', challenge.code), { competition_mode: 'individual', participant_ids: [] }, { preserveScroll: true })
                        }
                    >
                        Ubah ke mode individu
                    </Button>
                    <Button
                        onClick={() => {
                            setErrors({});
                            setEditing({ id: null, name: '', members: new Set() });
                        }}
                    >
                        <Plus /> Kelompok
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {teams.length === 0 && <p className="text-muted-foreground text-sm">Belum ada kelompok.</p>}
                {teams.map((t) => (
                    <div key={t.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{t.name}</p>
                            <div className="flex">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setErrors({});
                                        setEditing({ id: t.id, name: t.name, members: new Set(t.member_ids) });
                                    }}
                                >
                                    Ubah
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Hapus kelompok"
                                    onClick={() => confirm(`Hapus kelompok ${t.name}?`) && router.delete(route('admin.teams.destroy', t.id), { preserveScroll: true })}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">{t.members.join(', ') || 'Belum ada anggota'}</p>
                    </div>
                ))}
            </CardContent>

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Ubah kelompok' : 'Kelompok baru'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="t-name">Nama kelompok</Label>
                                <Input id="t-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                                <InputError message={errors.name} />
                            </div>
                            {controls}
                            <InputError message={errors.member_ids} />
                            <CandidateGrid
                                candidates={visible.filter((c) => !takenElsewhere.has(c.id))}
                                selected={editing.members}
                                onToggle={(id) => {
                                    const members = new Set(editing.members);
                                    if (members.has(id)) members.delete(id);
                                    else members.add(id);
                                    setEditing({ ...editing, members });
                                }}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>
                            Batal
                        </Button>
                        <Button onClick={save}>Simpan ({editing?.members.size ?? 0} anggota)</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function Settings({ challenge, gameTypes }: Props) {
    const [showKey, setShowKey] = useState(false);
    const form = useForm<ChallengeFormData>({
        code: challenge.code,
        title: challenge.title,
        description: challenge.description ?? '',
        chapter: challenge.chapter,
        game_type: challenge.game_type,
        is_deathmatch: challenge.is_deathmatch,
        answer_key: challenge.answer_key,
        max_winners: challenge.max_winners,
        max_attempts: challenge.max_attempts ? String(challenge.max_attempts) : '',
    });

    return (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
            <Card>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.put(route('admin.challenges.update', challenge.code), {
                                preserveScroll: true,
                                // Kode berubah → URL halaman ikut berubah.
                                onSuccess: () => form.data.code !== challenge.code && router.visit(route('admin.challenges.show', form.data.code)),
                            });
                        }}
                        className="space-y-5"
                    >
                        <ChallengeFormFields form={form} gameTypes={gameTypes} />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.processing}>
                                Simpan pengaturan
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Kunci jawaban saat ini</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                        <span className="font-mono text-lg">{showKey ? challenge.answer_key : '••••••'}</span>
                        <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Sembunyikan' : 'Tampilkan'}>
                            {showKey ? <EyeOff /> : <Eye />}
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-destructive/30">
                    <CardHeader>
                        <CardTitle className="text-base">Zona berbahaya</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <Button
                            variant="outline"
                            onClick={() =>
                                confirm('Hapus semua jawaban dan kunci game kembali? Waktu mulai juga direset.') &&
                                router.post(route('admin.challenges.reset', challenge.code), {}, { preserveScroll: true })
                            }
                        >
                            <RotateCcw /> Reset game
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => confirm(`Hapus challenge ${challenge.title} beserta seluruh jawabannya?`) && router.delete(route('admin.challenges.destroy', challenge.code))}
                        >
                            <Trash2 /> Hapus challenge
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
