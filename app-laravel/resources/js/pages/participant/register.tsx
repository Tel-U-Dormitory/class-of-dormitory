import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    buildings: { id: number; name: string }[];
}

type RegisterForm = {
    full_name: string;
    nim: string;
    email: string;
    building_id: string;
    room_number: string;
    major: string;
    photo: File | null;
    achievements: string[];
    agreement: boolean;
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

export default function Register({ buildings }: Props) {
    const { data, setData, post, processing, errors } = useForm<RegisterForm>({
        full_name: '',
        nim: '',
        email: '',
        building_id: '',
        room_number: '',
        major: '',
        photo: null,
        achievements: ['', '', ''],
        agreement: false,
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
        post(route('participant.register'), { forceFormData: true, preserveScroll: true });
    };

    const err = errors as Record<string, string | undefined>;

    return (
        <PublicLayout className="px-4 py-10 sm:px-6 sm:py-14">
            <Head title="Pendaftaran Peserta" />

            <div className="mx-auto max-w-3xl">
                <div className="mb-8">
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">Pendaftaran Peserta</h1>
                    <p className="text-muted-foreground mt-2">
                        Data ini dipakai panitia untuk verifikasi dan pengelompokan per gedung. Setelah mendaftar kamu mendapat token login pribadi.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6" noValidate>
                    <Card>
                        <CardHeader>
                            <CardTitle>Data diri</CardTitle>
                            <CardDescription>Sesuai data akademik.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <Field id="full_name" label="Nama lengkap" error={errors.full_name}>
                                    <Input id="full_name" value={data.full_name} onChange={(e) => setData('full_name', e.target.value)} autoComplete="name" required />
                                </Field>
                            </div>
                            <Field id="nim" label="NIM" error={errors.nim} hint="Dipakai untuk login ujian.">
                                <Input id="nim" inputMode="numeric" value={data.nim} onChange={(e) => setData('nim', e.target.value)} required />
                            </Field>
                            <Field id="email" label="Email" error={errors.email}>
                                <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} autoComplete="email" required />
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
                                <NativeSelect id="building_id" value={data.building_id} onChange={(e) => setData('building_id', e.target.value)} required>
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
                            <CardTitle>Foto & prestasi</CardTitle>
                            <CardDescription>Foto wajah yang jelas (JPG/PNG/WebP, maks. 3 MB). Prestasi opsional, maksimal tiga.</CardDescription>
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
                                            onChange={(e) => setData('achievements', data.achievements.map((a, j) => (j === i ? e.target.value : a)))}
                                        />
                                    </Field>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-card flex items-start gap-3 rounded-xl border p-4">
                        <Checkbox id="agreement" checked={data.agreement} onCheckedChange={(v) => setData('agreement', v === true)} className="mt-0.5" />
                        <div>
                            <Label htmlFor="agreement" className="leading-relaxed font-normal">
                                Saya menyatakan data di atas benar, bersedia mengerjakan ujian secara jujur tanpa bantuan, dan menerima keputusan panitia.
                            </Label>
                            <InputError message={errors.agreement} className="mt-1" />
                        </div>
                    </div>

                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground text-sm">
                            Sudah terdaftar?{' '}
                            <Link href={route('participant.login')} className="text-foreground underline underline-offset-4">
                                Masuk
                            </Link>
                        </p>
                        <Button type="submit" size="lg" disabled={processing}>
                            {processing && <LoaderCircle className="animate-spin" />}
                            Kirim pendaftaran
                        </Button>
                    </div>
                </form>
            </div>
        </PublicLayout>
    );
}
