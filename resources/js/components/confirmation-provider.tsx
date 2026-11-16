import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Request = { message: string; input?: boolean };
type Ask = (request: Request) => Promise<string | boolean>;
const ConfirmationContext = createContext<Ask | null>(null);

export function useConfirmation() {
    const ask = useContext(ConfirmationContext);
    if (!ask) throw new Error('ConfirmationProvider is required');
    return {
        confirm: async (message: string) => (await ask({ message })) === true,
        promptMinutes: async (message: string) => {
            const result = await ask({ message, input: true });
            return typeof result === 'string' ? Number(result) : null;
        },
    };
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
    const [request, setRequest] = useState<Request | null>(null);
    const [value, setValue] = useState('5');
    const resolve = useRef<((result: string | boolean) => void) | null>(null);
    const trigger = useRef<HTMLElement | null>(null);

    const ask: Ask = (next) => {
        // Ignore repeated clicks while a decision is pending.
        if (resolve.current) return Promise.resolve(false);
        trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setValue('5');
        setRequest(next);
        return new Promise((done) => {
            resolve.current = done;
        });
    };
    const finish = (result: string | boolean) => {
        const done = resolve.current;
        resolve.current = null;
        setRequest(null);
        done?.(result);
    };
    useEffect(
        () => () => {
            resolve.current?.(false);
        },
        [],
    );

    return (
        <ConfirmationContext.Provider value={ask}>
            {children}
            <Dialog
                open={request !== null}
                onOpenChange={(open) => {
                    if (!open) finish(false);
                }}
            >
                <DialogContent
                    onOpenAutoFocus={(event) => {
                        if (!request?.input) {
                            event.preventDefault();
                            document.getElementById('confirmation-cancel')?.focus();
                        }
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        trigger.current?.focus();
                    }}
                >
                    <form
                        className="space-y-6"
                        onSubmit={(event) => {
                            event.preventDefault();
                            finish(request?.input ? value : true);
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>{request?.input ? 'Tambah waktu ujian' : 'Konfirmasi tindakan'}</DialogTitle>
                            <DialogDescription className="break-words whitespace-pre-line">{request?.message}</DialogDescription>
                        </DialogHeader>
                        {request?.input && (
                            <div className="space-y-2">
                                <Label htmlFor="confirmation-minutes">Tambahan waktu (menit)</Label>
                                <Input
                                    id="confirmation-minutes"
                                    type="number"
                                    min={1}
                                    max={60}
                                    step={1}
                                    required
                                    autoFocus
                                    value={value}
                                    onChange={(event) => setValue(event.target.value)}
                                />
                                <p className="text-muted-foreground text-sm">Masukkan 1–60 menit.</p>
                            </div>
                        )}
                        <DialogFooter className="gap-2">
                            <Button id="confirmation-cancel" type="button" variant="outline" onClick={() => finish(false)}>
                                Batal
                            </Button>
                            <Button type="submit">{request?.input ? 'Tambah waktu' : 'Ya, lanjutkan'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </ConfirmationContext.Provider>
    );
}
