import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function ParticipantLogin() {
    const { data, setData, post, processing, errors, reset } = useForm({ nim: '', token: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('participant.login'), { onError: () => reset('token') });
    };

    return (
        <PublicLayout className="flex items-center px-4 py-12 sm:py-20">
            <Head title="Masuk Peserta" />

            <Card className="mx-auto w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Masuk peserta</CardTitle>
                    <CardDescription>Gunakan NIM dan token yang kamu dapat saat mendaftar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="nim">NIM</Label>
                            <Input id="nim" inputMode="numeric" autoComplete="username" autoFocus value={data.nim} onChange={(e) => setData('nim', e.target.value)} />
                            <InputError message={errors.nim} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="token">Token</Label>
                            <Input
                                id="token"
                                autoComplete="off"
                                placeholder="XXXX-XXXX"
                                className="font-mono tracking-widest uppercase"
                                value={data.token}
                                onChange={(e) => setData('token', e.target.value)}
                            />
                            <InputError message={errors.token} />
                        </div>
                        <Button type="submit" disabled={processing} className="w-full">
                            {processing && <LoaderCircle className="animate-spin" />}
                            Masuk
                        </Button>
                        <p className="text-muted-foreground text-center text-sm">
                            Belum punya token?{' '}
                            <Link href={route('participant.register')} className="text-foreground underline underline-offset-4">
                                Daftar
                            </Link>
                            <br />
                            Lupa token? Hubungi panitia gedungmu.
                        </p>
                    </form>
                </CardContent>
            </Card>
        </PublicLayout>
    );
}
