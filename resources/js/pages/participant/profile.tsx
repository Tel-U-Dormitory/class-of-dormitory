import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ImagePlus, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    participant: {
        full_name: string;
        nim: string;
        achievements: string[];
        photo_url: string | null;
    };
}

type ProfileForm = {
    photo: File | null;
    achievements: string[];
};

const MAX_ACHIEVEMENTS = 3;

export default function ParticipantProfile({ participant }: Props) {
    // Selalu sediakan tiga isian: yang sudah ada diisi, sisanya kosong.
    const initial = [...participant.achievements, '', '', ''].slice(0, MAX_ACHIEVEMENTS);

    const { data, setData, post, processing, errors } = useForm<ProfileForm>({
        photo: null,
        achievements: initial,
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
        post(route('participant.profile.update'), { forceFormData: true, preserveScroll: true });
    };

    const err = errors as Record<string, string | undefined>;
    const shownPhoto = preview ?? participant.photo_url;

    return (
        <PublicLayout className="px-4 py-10 sm:px-6 sm:py-14">
            <Head title="Edit Profil" />

            <div className="mx-auto max-w-3xl">
                <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
                    <Link href={route('participant.dashboard')}>
                        <ArrowLeft /> Kembali
                    </Link>
                </Button>

                <div className="mb-8">
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">Edit Profil</h1>
                    <p className="text-muted-foreground mt-2">
                        {participant.full_name} · {participant.nim}. Nama, NIM, gedung, dan kamar tidak bisa diubah sendiri. Hubungi panitia jika ada yang salah.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6" noValidate>
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
                                    {shownPhoto ? (
                                        <img src={shownPhoto} alt="Foto profil" className="size-full object-cover" />
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
                                {shownPhoto && <p className="text-muted-foreground mt-2 text-center text-xs">Klik foto untuk mengganti</p>}
                                <InputError message={errors.photo} className="mt-2" />
                            </div>

                            <div className="grid content-start gap-3">
                                {data.achievements.map((value, i) => (
                                    <div key={i} className="grid gap-2">
                                        <Label htmlFor={`achievement-${i}`}>Prestasi {i + 1}</Label>
                                        <Input
                                            id={`achievement-${i}`}
                                            value={value}
                                            placeholder={i === 0 ? 'Contoh: Juara 2 OSN Matematika 2024' : ''}
                                            onChange={(e) => setData('achievements', data.achievements.map((a, j) => (j === i ? e.target.value : a)))}
                                        />
                                        <InputError message={err[`achievements.${i}`]} />
                                    </div>
                                ))}
                                <InputError message={errors.achievements} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                        <Button asChild variant="outline" size="lg">
                            <Link href={route('participant.dashboard')}>Batal</Link>
                        </Button>
                        <Button type="submit" size="lg" disabled={processing}>
                            {processing && <LoaderCircle className="animate-spin" />}
                            Simpan profil
                        </Button>
                    </div>
                </form>
            </div>
        </PublicLayout>
    );
}