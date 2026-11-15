import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Item {
    id: number;
    caption: string | null;
    url: string;
}

export default function Documentation({ items, landingLimit, title }: { items: Item[]; landingLimit: number; title: string }) {
    const [editing, setEditing] = useState<Item | 'new' | null>(null);

    const move = (item: Item, direction: 'up' | 'down') => router.patch(route('admin.documentation.move', item.id), { direction }, { preserveScroll: true });

    return (
        <AppLayout breadcrumbs={[{ title: 'Dokumentasi', href: '/admin/dokumentasi' }]}>
            <Head title="Dokumentasi" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Dokumentasi season lalu"
                    description={`Beranda hanya menampilkan ${landingLimit} foto teratas. Atur urutannya dengan tombol panah. Jika belum ada foto, beranda memakai foto bawaan.`}
                    actions={
                        <Button onClick={() => setEditing('new')}>
                            <Plus /> Tambah foto
                        </Button>
                    }
                />

                <TitleForm title={title} />

                {items.length === 0 ? (
                    <div className="text-muted-foreground bg-card rounded-xl border p-10 text-center text-sm">
                        Belum ada foto. Beranda masih memakai foto bawaan.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {items.map((item, index) => {
                            const shown = index < landingLimit;

                            return (
                                <div key={item.id} className={cn('bg-card overflow-hidden rounded-xl border', !shown && 'opacity-60')}>
                                    <img src={item.url} alt={item.caption ?? 'Dokumentasi'} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                                    <div className="space-y-3 p-3">
                                        <div>
                                            <p className="truncate text-sm font-medium">{item.caption || 'Tanpa keterangan'}</p>
                                            <p className={cn('text-xs', shown ? 'text-emerald-500' : 'text-muted-foreground')}>
                                                {shown ? `Tampil di beranda (urutan ${index + 1})` : 'Tidak tampil (di luar 4 teratas)'}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex">
                                                <Button size="icon" variant="ghost" aria-label="Naikkan" disabled={index === 0} onClick={() => move(item, 'up')}>
                                                    <ArrowUp />
                                                </Button>
                                                <Button size="icon" variant="ghost" aria-label="Turunkan" disabled={index === items.length - 1} onClick={() => move(item, 'down')}>
                                                    <ArrowDown />
                                                </Button>
                                            </div>
                                            <div className="flex">
                                                <Button size="icon" variant="ghost" aria-label="Ubah" onClick={() => setEditing(item)}>
                                                    <Pencil />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    aria-label="Hapus"
                                                    onClick={() => confirm('Hapus foto ini?') && router.delete(route('admin.documentation.destroy', item.id), { preserveScroll: true })}
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {editing && <DocumentationDialog key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function TitleForm({ title }: { title: string }) {
    const form = useForm({ title });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(route('admin.documentation.title'), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="bg-card space-y-2 rounded-xl border p-4">
            <Label htmlFor="doc-title">Judul bagian di beranda</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="doc-title" value={form.data.title} maxLength={80} onChange={(e) => form.setData('title', e.target.value)} />
                <Button type="submit" disabled={form.processing || form.data.title.trim() === ''}>
                    Simpan judul
                </Button>
            </div>
            <InputError message={form.errors.title} />
        </form>
    );
}

function DocumentationDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
    const form = useForm<{ caption: string; image: File | null }>({ caption: item?.caption ?? '', image: null });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { forceFormData: true, preserveScroll: true, onSuccess: onClose };

        if (item) {
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('admin.documentation.update', item.id), options);
        } else {
            form.post(route('admin.documentation.store'), options);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{item ? 'Ubah foto' : 'Tambah foto'}</DialogTitle>
                        <DialogDescription>Format JPG, PNG, atau WebP, maksimal 2 MB. Rasio 4:3 paling pas (misalnya 1200 x 900 px).</DialogDescription>
                    </DialogHeader>

                    {item && <img src={item.url} alt="" className="h-32 rounded border object-cover" />}

                    <div className="grid gap-2">
                        <Label htmlFor="doc-image">{item ? 'Ganti foto (opsional)' : 'Foto'}</Label>
                        <Input id="doc-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => form.setData('image', e.target.files?.[0] ?? null)} />
                        <InputError message={form.errors.image} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="doc-caption">Keterangan (opsional)</Label>
                        <Input id="doc-caption" value={form.data.caption} maxLength={120} onChange={(e) => form.setData('caption', e.target.value)} />
                        <InputError message={form.errors.caption} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}