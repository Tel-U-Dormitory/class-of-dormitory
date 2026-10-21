import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type InertiaFormProps } from '@inertiajs/react';
import { type GameTypeOption } from './challenge-types';

export type ChallengeFormData = {
    code: string;
    title: string;
    description: string;
    chapter: number;
    game_type: string;
    is_deathmatch: boolean;
    answer_key: string;
    max_winners: number;
    max_attempts: string;
};

export function ChallengeFormFields({ form, gameTypes }: { form: InertiaFormProps<ChallengeFormData>; gameTypes: GameTypeOption[] }) {
    const type = gameTypes.find((t) => t.value === form.data.game_type);

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="c-title">Nama game</Label>
                <Input id="c-title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="Numerical Odyssey" />
                <InputError message={form.errors.title} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="c-code">Kode (URL kiosk)</Label>
                <Input id="c-code" value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} placeholder="ch1_main" className="font-mono" />
                <InputError message={form.errors.code} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="c-chapter">Chapter</Label>
                <Input id="c-chapter" type="number" min={1} value={form.data.chapter} onChange={(e) => form.setData('chapter', Number(e.target.value))} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="c-type">Tipe game</Label>
                <NativeSelect
                    id="c-type"
                    value={form.data.game_type}
                    onChange={(e) => {
                        const next = gameTypes.find((t) => t.value === e.target.value);
                        form.setData((d) => ({ ...d, game_type: e.target.value, max_attempts: next?.default_max_attempts ? String(next.default_max_attempts) : '' }));
                    }}
                >
                    {gameTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </NativeSelect>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="c-key">{form.data.game_type === 'numerical_odyssey' ? 'Angka target' : 'Kunci jawaban'}</Label>
                <Input id="c-key" value={form.data.answer_key} onChange={(e) => form.setData('answer_key', e.target.value)} className="font-mono" autoComplete="off" />
                <p className="text-muted-foreground text-xs">{type?.hint}</p>
                <InputError message={form.errors.answer_key} />
            </div>
            <div className="grid content-start gap-2">
                <Label htmlFor="c-attempts">Maks. percobaan</Label>
                <Input
                    id="c-attempts"
                    type="number"
                    min={1}
                    value={form.data.max_attempts}
                    onChange={(e) => form.setData('max_attempts', e.target.value)}
                    placeholder="Tanpa batas"
                />
                <p className="text-muted-foreground text-xs">Kosongkan untuk tanpa batas. Game sekali-jawab tidak menampilkan benar/salah di kiosk.</p>
            </div>
            <div className="grid content-start gap-2">
                <Label htmlFor="c-winners">Kuota lolos (N tercepat)</Label>
                <Input id="c-winners" type="number" min={1} value={form.data.max_winners} onChange={(e) => form.setData('max_winners', Number(e.target.value))} />
            </div>
            <label className="flex items-center gap-2 self-center text-sm">
                <Checkbox checked={form.data.is_deathmatch} onCheckedChange={(v) => form.setData('is_deathmatch', v === true)} /> Game deathmatch
            </label>
            <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="c-desc">Instruksi di layar kiosk</Label>
                <Textarea id="c-desc" rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
            </div>
        </div>
    );
}
