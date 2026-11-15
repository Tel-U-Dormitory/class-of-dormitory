import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const isPassword = type === 'password';

    const input = (
        <input
            type={isPassword && visible ? 'text' : type}
            className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                isPassword && 'pr-10',
                className,
            )}
            ref={ref}
            {...props}
        />
    );

    if (!isPassword) {
        return input;
    }

    // Tombol mata sendiri: warnanya mengikuti tema (putih di latar gelap, hitam di latar terang).
    return (
        <div className="relative">
            {input}
            <button
                type="button"
                tabIndex={-1}
                aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
                className="text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md opacity-70 hover:opacity-100"
            >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
        </div>
    );
});

Input.displayName = 'Input';

export { Input };