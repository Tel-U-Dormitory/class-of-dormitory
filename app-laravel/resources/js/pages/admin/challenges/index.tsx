import { ChallengeFormFields, type ChallengeFormData } from '@/components/admin/challenge-form';
import { type ChallengeSummary, type GameTypeOption } from '@/components/admin/challenge-types';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ExternalLink, Lock, Play, Plus, Skull, Swords, User, Users } from 'lucide-react';
import { useState } from 'react';

interface Props {
    challenges: (ChallengeSummary & { submissions_count: number; correct_count: number })[];
    gameTypes: GameTypeOption[];
}

export default function ChallengesIndex({ challenges, gameTypes }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm<ChallengeFormData>({
        code: '',
        title: '',
        description: '',
        chapter: 1,
        game_type: 'numerical_odyssey',
        is_deathmatch: false,
        answer_key: '24',
        max_winners: 5,
        max_attempts: '',
    });

    const chapters = [...new Set(challenges.map((c) => c.chapter))];

    const setStatus = (c: ChallengeSummary, status: string) => router.patch(route('admin.challenges.status', c.code), { status }, { preserveScroll: true });

    return (
        <AppLayout breadcrumbs={[{ title: 'Challenge & Game', href: '/admin/challenge' }]}>
            <Head title="Challenge & Game" />
            <div className="space-y-8 p-4 md:p-6">
                <PageHeader
                    title="Challenge & Game"
                    description="Game panggung per chapter. Buka game, lalu tampilkan layar kiosk di perangkat peserta."
                    actions={
                        <Button onClick={() => setOpen(true)}>
                            <Plus /> Challenge baru
                        </Button>
                    }
                />

                {challenges.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-12 text-center">Belum ada challenge.</CardContent>
                    </Card>
                )}

                {chapters.map((chapter) => (
                    <section key={chapter} className="space-y-3">
                        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Chapter {chapter}</h2>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {challenges
                                .filter((c) => c.chapter === chapter)
                                .map((c) => (
                                    <Card key={c.id} className={cn('gap-4', c.is_deathmatch && 'border-red-500/40')}>
                                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 text-xs font-semibold',
                                                        c.is_deathmatch ? 'text-red-500' : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {c.is_deathmatch ? <Skull className="size-3.5" /> : <Swords className="size-3.5" />}
                                                    {c.is_deathmatch ? 'Deathmatch' : 'Main game'}
                                                </span>
                                                <Link href={route('admin.challenges.show', c.code)} className="mt-1 block truncate font-semibold hover:underline">
                                                    {c.title}
                                                </Link>
                                                <code className="text-muted-foreground text-xs">{c.code}</code>
                                            </div>
                                            <StatusBadge status={c.status === 'active' ? 'open' : c.status === 'ended' ? 'closed' : 'draft'} label={c.status_label} />
                                        </CardHeader>
                                        <CardContent className="text-muted-foreground space-y-1.5 text-sm">
                                            <p>{c.game_type_label}</p>
                                            <p className="flex items-center gap-1.5">
                                                {c.competition_mode === 'team' ? <Users className="size-4" /> : <User className="size-4" />}
                                                {c.competition_mode === 'team' ? 'Kelompok' : 'Individu'} · {c.max_winners} tercepat lolos
                                            </p>
                                            <p>
                                                {c.correct_count} benar dari {c.submissions_count} jawaban
                                            </p>
                                        </CardContent>
                                        <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
                                            {c.status === 'active' ? (
                                                <Button size="sm" variant="destructive" onClick={() => setStatus(c, 'ended')}>
                                                    <Lock /> Tutup
                                                </Button>
                                            ) : (
                                                <Button size="sm" onClick={() => setStatus(c, 'active')}>
                                                    <Play /> Buka
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" asChild>
                                                <Link href={route('admin.challenges.show', c.code)}>Kelola</Link>
                                            </Button>
                                            <Button size="sm" variant="ghost" asChild className="ml-auto">
                                                <a href={c.arena_url} target="_blank" rel="noreferrer">
                                                    <ExternalLink /> Kiosk
                                                </a>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                        </div>
                    </section>
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(route('admin.challenges.store'));
                        }}
                        className="space-y-5"
                    >
                        <DialogHeader>
                            <DialogTitle>Challenge baru</DialogTitle>
                            <DialogDescription>Game dibuat dalam keadaan terkunci. Kunci jawaban hanya tersimpan di server.</DialogDescription>
                        </DialogHeader>
                        <ChallengeFormFields form={form} gameTypes={gameTypes} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                Buat challenge
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
