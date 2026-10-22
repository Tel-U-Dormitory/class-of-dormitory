import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link } from '@inertiajs/react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

interface Props {
    registration: { full_name: string; nim: string; building: string; token: string };
}

export default function Registered({ registration }: Props) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(registration.token);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <PublicLayout className="px-4 py-12 sm:py-20">
            <Head title="Pendaftaran Berhasil" />

            <div className="mx-auto max-w-lg text-center">
                <div className="bg-primary/15 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                    <KeyRound className="size-7" />
                </div>
                <h1 className="font-display mt-6 text-2xl font-bold">Pendaftaran berhasil</h1>
                <p className="text-muted-foreground mt-2">
                    {registration.full_name} · {registration.nim} · {registration.building}
                </p>

                <Card className="mt-8">
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">Token login kamu</p>
                        <p className="font-mono text-4xl font-bold tracking-[0.2em] select-all">{registration.token}</p>
                        <Button variant="outline" onClick={copy} className="w-full">
                            {copied ? <Check /> : <Copy />}
                            {copied ? 'Tersalin' : 'Salin token'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="mt-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-left text-sm">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
                    <p>
                        <strong>Simpan token ini sekarang.</strong> Token hanya ditampilkan satu kali dan tidak dikirim ulang. Jika hilang, hubungi panitia untuk
                        dibuatkan token baru.
                    </p>
                </div>

                <Button asChild size="lg" className="mt-8 w-full">
                    <Link href={route('participant.login')}>Lanjut masuk</Link>
                </Button>
            </div>
        </PublicLayout>
    );
}
