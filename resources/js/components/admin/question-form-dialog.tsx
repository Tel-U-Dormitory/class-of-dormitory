import { MathText } from '@/components/exam/math-text';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { type BankQuestion } from './question-bank-types';

type OptionInput = { content: string; image: File | null; image_url: string | null };

type QuestionForm = {
    body: string;
    is_latex: boolean;
    image: File | null;
    remove_image: boolean;
    options_are_images: boolean;
    points: number;
    penalty: number;
    is_active: boolean;
    notes: string;
    position: string;
    correct_option: number;
    options: OptionInput[];
};

const emptyOptions = (): OptionInput[] => Array.from({ length: 4 }, () => ({ content: '', image: null, image_url: null }));

export function QuestionFormDialog({
    open,
    onOpenChange,
    groupId,
    question,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: number;
    question: BankQuestion | null;
}) {
    const form = useForm<QuestionForm>({
        body: question?.body ?? '',
        is_latex: question?.is_latex ?? false,
        image: null,
        remove_image: false,
        options_are_images: question?.options_are_images ?? false,
        points: question?.points ?? 4,
        penalty: question?.penalty ?? 1,
        is_active: question?.is_active ?? true,
        notes: question?.notes ?? '',
        position: question ? String(question.position) : '',
        correct_option: Math.max(0, question?.options.findIndex((o) => o.is_correct) ?? 0),
        options: question ? question.options.map((o) => ({ content: o.content ?? '', image: null, image_url: o.image_url })) : emptyOptions(),
    });
    const errors = form.errors as Record<string, string | undefined>;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { forceFormData: true, preserveScroll: true, onSuccess: () => onOpenChange(false) };
        if (question) {
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('admin.questions.update', question.id), options);
        } else {
            form.post(route('admin.questions.store', groupId), options);
        }
    };

    const setOption = (i: number, patch: Partial<OptionInput>) => form.setData('options', form.data.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>{question ? 'Ubah soal' : 'Soal baru'}</DialogTitle>
                        <DialogDescription>Kunci jawaban hanya tersimpan di server dan tidak pernah dikirim ke peserta.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="q-body">Pertanyaan</Label>
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={form.data.is_latex} onCheckedChange={(v) => form.setData('is_latex', v === true)} /> Mengandung LaTeX ($…$)
                            </label>
                        </div>
                        <Textarea id="q-body" rows={4} value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} />
                        <InputError message={errors.body} />
                        {form.data.is_latex && form.data.body && (
                            <div className="bg-muted/40 rounded-md border p-3">
                                <p className="text-muted-foreground mb-1 text-xs">Pratinjau</p>
                                <MathText text={form.data.body} latex className="exam-prose" />
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="q-image">Gambar soal (opsional)</Label>
                        {question?.image_url && !form.data.remove_image && !form.data.image && (
                            <div className="flex items-center gap-3">
                                <img src={question.image_url} alt="" className="h-20 rounded border object-contain" />
                                <Button type="button" variant="ghost" size="sm" onClick={() => form.setData('remove_image', true)}>
                                    Hapus gambar
                                </Button>
                            </div>
                        )}
                        <Input id="q-image" type="file" accept="image/*" onChange={(e) => form.setData('image', e.target.files?.[0] ?? null)} />
                        <InputError message={errors.image} />
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label>Pilihan jawaban · klik huruf untuk menandai kunci</Label>
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={form.data.options_are_images} onCheckedChange={(v) => form.setData('options_are_images', v === true)} /> Pilihan berupa gambar
                            </label>
                        </div>
                        {form.data.options.map((option, i) => {
                            const isCorrect = form.data.correct_option === i;
                            return (
                                <div key={i} className={cn('flex items-start gap-3 rounded-lg border p-2', isCorrect && 'border-emerald-500/60 bg-emerald-500/5')}>
                                    <button
                                        type="button"
                                        onClick={() => form.setData('correct_option', i)}
                                        className={cn(
                                            'flex size-9 shrink-0 items-center justify-center rounded-md border text-sm font-semibold',
                                            isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'bg-muted hover:bg-accent',
                                        )}
                                        aria-label={`Jadikan ${String.fromCharCode(65 + i)} kunci jawaban`}
                                        aria-pressed={isCorrect}
                                    >
                                        {String.fromCharCode(65 + i)}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        {form.data.options_are_images ? (
                                            <div className="flex items-center gap-3">
                                                {(option.image || option.image_url) && (
                                                    <img
                                                        src={option.image ? URL.createObjectURL(option.image) : option.image_url!}
                                                        alt=""
                                                        className="h-14 w-20 rounded border object-contain"
                                                    />
                                                )}
                                                <Input type="file" accept="image/*" onChange={(e) => setOption(i, { image: e.target.files?.[0] ?? null })} />
                                            </div>
                                        ) : (
                                            <Input value={option.content} onChange={(e) => setOption(i, { content: e.target.value })} placeholder={`Pilihan ${String.fromCharCode(65 + i)}`} />
                                        )}
                                        <InputError message={errors[`options.${i}.content`] ?? errors[`options.${i}.image`]} className="mt-1" />
                                    </div>
                                    {form.data.options.length > 2 && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            aria-label="Hapus pilihan"
                                            onClick={() => {
                                                form.setData((d) => ({
                                                    ...d,
                                                    options: d.options.filter((_, j) => j !== i),
                                                    correct_option: d.correct_option === i ? 0 : d.correct_option > i ? d.correct_option - 1 : d.correct_option,
                                                }));
                                            }}
                                        >
                                            <Trash2 />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                        {form.data.options.length < 6 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => form.setData('options', [...form.data.options, { content: '', image: null, image_url: null }])}>
                                <Plus /> Pilihan
                            </Button>
                        )}
                        <InputError message={errors.correct_option ?? errors.options} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="grid gap-2">
                            <Label htmlFor="q-points">Poin benar</Label>
                            <Input id="q-points" type="number" min={0} value={form.data.points} onChange={(e) => form.setData('points', Number(e.target.value))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="q-penalty">Penalti salah</Label>
                            <Input id="q-penalty" type="number" min={0} value={form.data.penalty} onChange={(e) => form.setData('penalty', Number(e.target.value))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="q-position">Urutan</Label>
                            <Input id="q-position" type="number" min={0} value={form.data.position} onChange={(e) => form.setData('position', e.target.value)} placeholder="auto" />
                        </div>
                        <label className="flex items-end gap-2 pb-2 text-sm">
                            <Checkbox checked={form.data.is_active} onCheckedChange={(v) => form.setData('is_active', v === true)} /> Aktif
                        </label>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="q-notes">Catatan internal</Label>
                        <Input id="q-notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="Tidak terlihat peserta" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <LoaderCircle className="animate-spin" />}
                            Simpan soal
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
