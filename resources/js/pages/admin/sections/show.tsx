import { GroupFormDialog } from '@/components/admin/group-form-dialog';
import { type BankGroup, type BankQuestion } from '@/components/admin/question-bank-types';
import { QuestionFormDialog } from '@/components/admin/question-form-dialog';
import { MathText } from '@/components/exam/math-text';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { type Option, type Pillar } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Film, Image, Lock, Pencil, Plus, Text, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';

interface Props {
    exam: { id: number; title: string; sections: { id: number; label: string }[] };
    section: { id: number; pillar: Pillar; label: string; minutes: number };
    groups: BankGroup[];
    stimulusTypes: Option[];
    locked: boolean;
}

const stimulusIcon = { none: null, text: Text, image: Image, video: Film, flash: Zap };

export default function SectionShow({ exam, section, groups, stimulusTypes, locked }: Props) {
    const [groupDialog, setGroupDialog] = useState<{ open: boolean; group: BankGroup | null }>({ open: false, group: null });
    const [questionDialog, setQuestionDialog] = useState<{ open: boolean; groupId: number; question: BankQuestion | null }>({ open: false, groupId: 0, question: null });
    const meta = pillarMeta[section.pillar];
    const total = groups.reduce((sum, g) => sum + g.questions.filter((q) => q.is_active).length, 0);

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Ujian & Bank Soal', href: '/admin/ujian' },
                { title: exam.title, href: route('admin.exams.edit', exam.id) },
                { title: section.label, href: route('admin.sections.show', section.id) },
            ]}
        >
            <Head title={`Bank soal ${section.label}`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={`Pilar ${section.label}`}
                    description={`${total} soal aktif · ${groups.length} grup · ${section.minutes} menit`}
                    actions={
                        <Button disabled={locked} onClick={() => setGroupDialog({ open: true, group: null })}>
                            <Plus /> Grup soal
                        </Button>
                    }
                />

                {locked && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                        <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p>
                            Bank soal terkunci karena ujian sedang dibuka atau masih ada peserta yang mengerjakan. Perubahan kunci jawaban atau poin di tengah
                            ujian akan membuat penilaian tidak adil. Setelah semua selesai, perbaiki soal lalu gunakan <strong>Hitung ulang nilai</strong> di
                            halaman ujian.
                        </p>
                    </div>
                )}

                <nav className="flex flex-wrap gap-2" aria-label="Pilar lain">
                    {exam.sections.map((s) => (
                        <Button key={s.id} asChild size="sm" variant={s.id === section.id ? 'secondary' : 'ghost'}>
                            <Link href={route('admin.sections.show', s.id)}>{s.label}</Link>
                        </Button>
                    ))}
                </nav>

                {groups.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-12 text-center">
                            Belum ada grup soal. Mulai dengan membuat grup, lalu tambahkan soal ke dalamnya.
                        </CardContent>
                    </Card>
                )}

                {groups.map((group) => {
                    const StimIcon = stimulusIcon[group.stimulus_type];
                    return (
                        <Card key={group.id} className="gap-0 overflow-hidden py-0">
                            <CardHeader className={cn('flex flex-row items-center justify-between gap-4 border-b border-l-4 py-4', meta.border)}>
                                <div className="min-w-0">
                                    <p className="font-semibold">
                                        <span className="text-muted-foreground mr-2 tabular-nums">#{group.position}</span>
                                        {group.title}
                                    </p>
                                    <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                                        {group.kind && <span>{group.kind}</span>}
                                        <span>{group.questions.length} soal</span>
                                        {StimIcon && (
                                            <span className="flex items-center gap-1">
                                                <StimIcon className="size-3.5" />
                                                Observasi {stimulusTypes.find((t) => t.value === group.stimulus_type)?.label.toLowerCase()}
                                                {group.stimulus_duration_seconds ? ` · ${group.stimulus_duration_seconds} dtk` : ''}
                                                {group.stimulus_type === 'flash' ? ` · ${group.stimulus_slides.length} slide` : ''}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    {group.stimulus_media_url && (
                                        <Button asChild size="icon" variant="ghost" aria-label="Lihat materi">
                                            <a href={group.stimulus_media_url} target="_blank" rel="noreferrer">
                                                <Eye />
                                            </a>
                                        </Button>
                                    )}
                                    <Button size="icon" variant="ghost" aria-label="Ubah grup" disabled={locked} onClick={() => setGroupDialog({ open: true, group })}>
                                        <Pencil />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        disabled={locked}
                                        aria-label="Hapus grup"
                                        onClick={() => confirm(`Hapus grup "${group.title}" beserta seluruh soalnya?`) && router.delete(route('admin.groups.destroy', group.id), { preserveScroll: true })}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="divide-y p-0">
                                {group.stimulus_type === 'text' && group.stimulus_text && (
                                    <p className="bg-muted/40 text-muted-foreground line-clamp-3 px-5 py-3 text-sm whitespace-pre-line">{group.stimulus_text}</p>
                                )}
                                {group.questions.map((q) => (
                                    <div key={q.id} className={cn('flex gap-4 px-5 py-4', !q.is_active && 'opacity-50')}>
                                        <span className="text-muted-foreground w-6 shrink-0 pt-0.5 text-sm tabular-nums">{q.position}</span>
                                        <div className="min-w-0 flex-1">
                                            <MathText text={q.body} latex={q.is_latex} className="line-clamp-3 text-sm whitespace-pre-line" />
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {q.options.map((o) => (
                                                    <span
                                                        key={o.id}
                                                        className={cn(
                                                            'inline-flex max-w-56 items-center gap-1 truncate rounded border px-2 py-0.5 text-xs',
                                                            o.is_correct ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        <strong>{o.label}</strong> {o.image_url ? 'gambar' : o.content}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-muted-foreground mt-1.5 text-xs">
                                                +{q.points} / −{q.penalty}
                                                {!q.is_active && ' · nonaktif'}
                                                {q.notes && ` · ${q.notes}`}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <Button size="icon" variant="ghost" aria-label="Ubah soal" disabled={locked} onClick={() => setQuestionDialog({ open: true, groupId: group.id, question: q })}>
                                                <Pencil />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                disabled={locked}
                                                aria-label="Hapus soal"
                                                onClick={() => confirm('Hapus soal ini?') && router.delete(route('admin.questions.destroy', q.id), { preserveScroll: true })}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="px-5 py-3">
                                    <Button size="sm" variant="ghost" disabled={locked} onClick={() => setQuestionDialog({ open: true, groupId: group.id, question: null })}>
                                        <Plus /> Tambah soal
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {groupDialog.open && (
                <GroupFormDialog
                    key={groupDialog.group?.id ?? 'new'}
                    open
                    onOpenChange={(open) => setGroupDialog((d) => ({ ...d, open }))}
                    sectionId={section.id}
                    group={groupDialog.group}
                    stimulusTypes={stimulusTypes}
                />
            )}
            {questionDialog.open && (
                <QuestionFormDialog
                    key={questionDialog.question?.id ?? `new-${questionDialog.groupId}`}
                    open
                    onOpenChange={(open) => setQuestionDialog((d) => ({ ...d, open }))}
                    groupId={questionDialog.groupId}
                    question={questionDialog.question}
                />
            )}
        </AppLayout>
    );
}
