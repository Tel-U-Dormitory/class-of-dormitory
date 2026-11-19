import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { Calculator, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';

export interface SectionAdjustmentData {
    id: number;
    label: string;
    score: number;
    score_web: number;
    adjustment_type: 'addition' | 'overwrite' | null;
    manual_score: number;
    adjustment_notes: string | null;
}

export function AdjustScoreDialog({
    open,
    onOpenChange,
    examId,
    attemptId,
    section,
    participantName,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    examId: number;
    attemptId: number;
    section: SectionAdjustmentData | null;
    participantName: string;
}) {
    const form = useForm({
        adjustment_type: section?.adjustment_type ?? 'none',
        manual_score: section?.manual_score ? String(section.manual_score) : '0',
        notes: section?.adjustment_notes ?? '',
    });

    useEffect(() => {
        if (section) {
            form.setData({
                adjustment_type: section.adjustment_type ?? 'none',
                manual_score: section.adjustment_type ? String(section.manual_score) : '0',
                notes: section.adjustment_notes ?? '',
            });
            form.clearErrors();
        }
    }, [section?.id, section?.adjustment_type, section?.manual_score, section?.adjustment_notes]);

    if (!section) return null;

    const errors = form.errors as Record<string, string | undefined>;
    const scoreWeb = section.score_web ?? 0;
    const manualScoreNum = parseInt(form.data.manual_score || '0', 10) || 0;

    let previewFinal = scoreWeb;
    if (form.data.adjustment_type === 'addition') {
        previewFinal = scoreWeb + manualScoreNum;
    } else if (form.data.adjustment_type === 'overwrite') {
        previewFinal = manualScoreNum;
    }

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.patch(route('admin.attempts.sections.adjust', [examId, attemptId, section.id]), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                            <Calculator className="size-4" /> Penyesuaian Nilai · {section.label}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Sesuaikan nilai untuk <strong className="text-foreground">{participantName}</strong>. Cocok untuk peserta yang mengerjakan sebagian di kertas atau mengulang tes.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Ringkasan Nilai Asli */}
                    <div className="bg-muted/50 grid grid-cols-2 gap-3 rounded-lg border p-3 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[0.7rem] uppercase">Nilai Asli Web</span>
                            <span className="text-sm font-semibold tabular-nums">{scoreWeb}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[0.7rem] uppercase">Nilai Saat Ini</span>
                            <span className="text-sm font-semibold tabular-nums">{section.score}</span>
                        </div>
                    </div>

                    {/* Mode Penyesuaian */}
                    <div className="space-y-1.5">
                        <Label htmlFor="adj-type" className="text-xs">Mode Penyesuaian</Label>
                        <NativeSelect
                            id="adj-type"
                            value={form.data.adjustment_type}
                            onChange={(e) => form.setData('adjustment_type', e.target.value as 'none' | 'addition' | 'overwrite')}
                            className="text-xs"
                        >
                            <option value="none">Tidak Ada (Murni Nilai Web)</option>
                            <option value="addition">Tambah Nilai Kertas (Web + Manual)</option>
                            <option value="overwrite">Timpa Nilai (Gunakan Nilai Baru / Ujian Ulang)</option>
                        </NativeSelect>
                        <InputError message={errors.adjustment_type} />
                    </div>

                    {/* Input Nilai Manual jika mode bukan none */}
                    {form.data.adjustment_type !== 'none' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="manual-score" className="text-xs">
                                {form.data.adjustment_type === 'addition' ? 'Nilai Tambahan dari Kertas' : 'Nilai Baru (Menggantikan Nilai Lama)'}
                            </Label>
                            <Input
                                id="manual-score"
                                type="number"
                                value={form.data.manual_score}
                                onChange={(e) => form.setData('manual_score', e.target.value)}
                                placeholder="0"
                                className="text-xs tabular-nums"
                            />
                            <p className="text-muted-foreground text-[0.7rem]">
                                {form.data.adjustment_type === 'addition'
                                    ? 'Nilai ini akan ditambahkan ke nilai web peserta di pilar ini.'
                                    : 'Nilai lama akan diabaikan dan pilar ini memakai nilai baru di atas.'}
                            </p>
                            <InputError message={errors.manual_score} />
                        </div>
                    )}

                    {/* Catatan / Alasan */}
                    <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-xs">Catatan / Alasan (Opsional)</Label>
                        <Textarea
                            id="notes"
                            rows={2}
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            placeholder="Contoh: Koreksi manual LJK kertas nomor 15-30"
                            className="text-xs"
                        />
                        <InputError message={errors.notes} />
                    </div>

                    {/* Kalkulasi Preview */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                        <div className="flex items-center justify-between font-medium">
                            <span>Perhitungan Nilai Akhir:</span>
                            <span className="text-sm font-bold text-primary tabular-nums">{previewFinal}</span>
                        </div>
                        <div className="text-muted-foreground mt-1 text-[0.7rem]">
                            {form.data.adjustment_type === 'addition' && (
                                <span>Rumus: {scoreWeb} (Web) + {manualScoreNum} (Kertas) = {previewFinal}</span>
                            )}
                            {form.data.adjustment_type === 'overwrite' && (
                                <span>Rumus: Nilai web diabaikan, nilai akhir disetel ke {previewFinal} (Timpa)</span>
                            )}
                            {form.data.adjustment_type === 'none' && (
                                <span>Murni menggunakan nilai web: {scoreWeb}</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" size="sm" disabled={form.processing}>
                            {form.processing && <LoaderCircle className="size-3.5 animate-spin" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
