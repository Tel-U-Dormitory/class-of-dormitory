import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    buildings: { id: number; name: string }[];
}

type CreateForm = {
    full_name: string;
    nim: string;
    email: string;
    building_id: string;
    room_number: string;
    major: string;
    photo: File | null;
    achievements: string[];
};

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
            <InputError message={error} />
        </div>
    );
}

export default function CreateParticipant({ buildings }: Props) {
    const { data, setData, post, processing, errors } = useForm<CreateForm>({
        full_name: '',
        nim: '',
        email: '',
        building_id: '',
        room_number: '',
        major: '',
        photo: null,
        achievements: ['', '', ''],
    });

    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!data.photo) return setPreview(null);
        const url = URL.createObjectURL(data.photo);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [data.photo]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.participants.store'), { forceFormData: true, preserveScroll: true });
    };

    const err = errors as Record<string, string | undefined>;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Peserta', href: '/admin/peserta' },
                { title: 'Tambah peserta', href: '/admin/peserta/baru' },
            ]}
        >
            <Head title="Tambah Peserta" />
            <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Tambah peserta"
                    description="Buat akun peserta. Setelah disimpan, token login ditampilkan sekali di halaman detail peserta."
                />

                <form onSubmit={submit} className="space-y-6" noValidate>
                    <Card>
                        <CardHeader>
                            <CardTitle>Data diri</CardTitle>
                            <CardDescription>Sesuai data akademik.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <Field id="full_name" label="Nama lengkap" error={errors.full_name}>
                                    <Input id="full_name" value={data.full_name} onChange={(e) => setData('full_name', e.target.value)} required />
                                </Field>
                            </div>
                            <Field id="nim" label="NIM" error={errors.nim} hint="Dipakai peserta untuk login ujian.">
                                <Input id="nim" inputMode="numeric" value={data.nim} onChange={(e) => setData('nim', e.target.value)} required />
                            </Field>
                            <Field id="email" label="Email (opsional)" error={errors.email}>
                                <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                            </Field>
                            <div className="sm:col-span-2">
                                <Field id="major" label="Program studi" error={errors.major}>
                                    <Input id="major" value={data.major} onChange={(e) => setData('major', e.target.value)} required />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Asrama</CardTitle>
                            <CardDescription>Peringkat seleksi dihitung per gedung.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 sm:grid-cols-2">
                            <Field id="building_id" label="Gedung" error={errors.building_id}>
                                <NativeSelect
                                    id="building_id"
                                    value={data.building_id}
                                    onChange={(e) => setData('building_id', e.target.value)}
                                    required
                                >
                                    <option value="" disabled>
                                        Pilih gedung
                                    </option>
                                    {buildings.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field id="room_number" label="Nomor kamar" error={errors.room_number}>
                                <Input id="room_number" value={data.room_number} onChange={(e) => setData('room_number', e.target.value)} required />
                            </Field>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Foto & prestasi (opsional)</CardTitle>
                            <CardDescription>Boleh dikosongkan. Peserta bisa menambahkannya sendiri nanti lewat edit profil.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                            <div>
                                <label
                                    htmlFor="photo"
                                    className="border-input hover:border-primary/60 bg-muted/40 flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed text-center transition"
                                >
                                    {preview ? (
                                        <img src={preview} alt="Pratinjau foto" className="size-full object-cover" />
                                    ) : (
                                        <span className="text-muted-foreground flex flex-col items-center gap-2 p-3 text-xs">
                                            <ImagePlus className="size-6" />
                                            Pilih foto
                                        </span>
                                    )}
                                </label>
                                <input
                                    id="photo"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    onChange={(e) => setData('photo', e.target.files?.[0] ?? null)}
                                />
                                <InputError message={errors.photo} className="mt-2" />
                            </div>
                            <div className="grid content-start gap-3">
                                {data.achievements.map((value, i) => (
                                    <Field key={i} id={`achievement-${i}`} label={`Prestasi ${i + 1}`} error={err[`achievements.${i}`]}>
                                        <Input
                                            id={`achievement-${i}`}
                                            value={value}
                                            placeholder={i === 0 ? 'Contoh: Juara 2 OSN Matematika 2024' : ''}
                                            onChange={(e) =>
                                                setData(
                                                    'achievements',
                                                    data.achievements.map((a, j) => (j === i ? e.target.value : a)),
                                                )
                                            }
                                        />
                                    </Field>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-end gap-3">
                        <Button asChild variant="ghost">
                            <Link href={route('admin.participants.index')}>Batal</Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="animate-spin" />}
                            Buat akun
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}