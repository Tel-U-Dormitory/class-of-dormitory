import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type Option } from '@/types';
import { useForm } from '@inertiajs/react';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { type BankGroup } from './question-bank-types';

type Slide = { path: string | null; url: string | null; image: File | null; duration: number };

type GroupForm = {
    title: string;
    kind: string;
    position: string;
    stimulus_type: BankGroup['stimulus_type'];
    stimulus_text: string;
    stimulus_duration_seconds: string;
    stimulus_media: File | null;
    slides: Slide[];
};

export function GroupFormDialog({
    open,
    onOpenChange,
    sectionId,
    group,
    stimulusTypes,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sectionId: number;
    group: BankGroup | null;
    stimulusTypes: Option[];
}) {
    const form = useForm<GroupForm>({
        title: group?.title ?? '',
        kind: group?.kind ?? '',
        position: group ? String(group.position) : '',
        stimulus_type: group?.stimulus_type ?? 'none',
        stimulus_text: group?.stimulus_text ?? '',
        stimulus_duration_seconds: group?.stimulus_duration_seconds ? String(group.stimulus_duration_seconds) : '45',
        stimulus_media: null,
        slides: group?.stimulus_slides.map((s) => ({ path: s.path, url: s.url, image: null, duration: s.duration })) ?? [],
    });
    const errors = form.errors as Record<string, string | undefined>;
    const type = form.data.stimulus_type;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { forceFormData: true, preserveScroll: true, onSuccess: () => onOpenChange(false) };
        if (group) {
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('admin.groups.update', group.id), options);
        } else {
            form.post(route('admin.groups.store', sectionId), options);
        }
    };

    const setSlide = (i: number, patch: Partial<Slide>) => form.setData('slides', form.data.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>{group ? 'Ubah grup soal' : 'Grup soal baru'}</DialogTitle>
                        <DialogDescription>Grup mengelompokkan soal sejenis. Materi observasi (opsional) tampil sekali sebelum soal grup bisa dikerjakan.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-[1fr_10rem_6rem]">
                        <div className="grid gap-2">
                            <Label htmlFor="g-title">Nama grup</Label>
                            <Input id="g-title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="Denah Gedung" />
                            <InputError message={errors.title} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="g-kind">Jenis</Label>
                            <Input id="g-kind" value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)} placeholder="floor-plan" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="g-position">Urutan</Label>
                            <Input id="g-position" type="number" min={0} value={form.data.position} onChange={(e) => form.setData('position', e.target.value)} placeholder="auto" />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="g-type">Materi observasi</Label>
                            <NativeSelect id="g-type" value={type} onChange={(e) => form.setData('stimulus_type', e.target.value as GroupForm['stimulus_type'])}>
                                {stimulusTypes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </div>
                        {['text', 'image', 'video'].includes(type) && (
                            <div className="grid gap-2">
                                <Label htmlFor="g-duration">Durasi tampil (detik)</Label>
                                <Input
                                    id="g-duration"
                                    type="number"
                                    min={3}
                                    value={form.data.stimulus_duration_seconds}
                                    onChange={(e) => form.setData('stimulus_duration_seconds', e.target.value)}
                                />
                                <InputError message={errors.stimulus_duration_seconds} />
                            </div>
                        )}
                    </div>

                    {type === 'text' && (
                        <div className="grid gap-2">
                            <Label htmlFor="g-text">Teks yang harus dihafal</Label>
                            <Textarea id="g-text" rows={6} value={form.data.stimulus_text} onChange={(e) => form.setData('stimulus_text', e.target.value)} />
                            <InputError message={errors.stimulus_text} />
                        </div>
                    )}

                    {(type === 'image' || type === 'video') && (
                        <div className="grid gap-2">
                            <Label htmlFor="g-media">{type === 'image' ? 'Gambar' : 'Video (MP4/WebM)'}</Label>
                            {group?.stimulus_media_url && !form.data.stimulus_media && (
                                <p className="text-muted-foreground text-xs">
                                    File saat ini tersimpan.{' '}
                                    <a href={group.stimulus_media_url} target="_blank" className="underline" rel="noreferrer">
                                        Lihat
                                    </a>
                                    . Unggah file baru untuk mengganti.
                                </p>
                            )}
                            <Input
                                id="g-media"
                                type="file"
                                accept={type === 'image' ? 'image/*' : 'video/mp4,video/webm'}
                                onChange={(e) => form.setData('stimulus_media', e.target.files?.[0] ?? null)}
                            />
                            <InputError message={errors.stimulus_media} />
                        </div>
                    )}

                    {type === 'flash' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Slide kilasan</Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => form.setData('slides', [...form.data.slides, { path: null, url: null, image: null, duration: 3 }])}
                                >
                                    <Plus /> Slide
                                </Button>
                            </div>
                            {form.data.slides.map((slide, i) => (
                                <div key={i} className="grid grid-cols-[3rem_1fr_6rem_auto] items-center gap-3 rounded-lg border p-2">
                                    <div className="bg-muted size-12 overflow-hidden rounded">
                                        {slide.image ? (
                                            <img src={URL.createObjectURL(slide.image)} className="size-full object-cover" alt="" />
                                        ) : slide.url ? (
                                            <img src={slide.url} className="size-full object-cover" alt="" />
                                        ) : null}
                                    </div>
                                    <Input type="file" accept="image/*" onChange={(e) => setSlide(i, { image: e.target.files?.[0] ?? null })} />
                                    <Input type="number" min={1} max={30} value={slide.duration} onChange={(e) => setSlide(i, { duration: Number(e.target.value) })} aria-label="Durasi detik" />
                                    <Button type="button" size="icon" variant="ghost" onClick={() => form.setData('slides', form.data.slides.filter((_, j) => j !== i))} aria-label="Hapus slide">
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}
                            <InputError message={errors.slides} />
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <LoaderCircle className="animate-spin" />}
                            Simpan grup
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
