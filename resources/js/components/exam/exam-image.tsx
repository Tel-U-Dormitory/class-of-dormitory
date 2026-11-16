import { useState } from 'react';

export function ExamImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
    return <ImageState key={src} src={src} alt={alt} className={className} />;
}

function ImageState({ src, alt, className }: { src: string; alt: string; className?: string }) {
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const retry = () => {
        setStatus('loading');
        setAttempt((value) => value + 1);
    };
    return (
        <span className="block min-w-0" aria-busy={status === 'loading'}>
            {status === 'loading' && (
                <span role="status" className="text-muted-foreground block text-sm">
                    Memuat gambar…
                </span>
            )}
            <img
                key={attempt}
                src={attempt ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src}
                alt={alt}
                className={className}
                style={{ display: status === 'loaded' ? undefined : 'none' }}
                draggable={false}
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
            />
            {status === 'error' && (
                <span role="alert" className="block text-sm">
                    Gambar gagal dimuat.{' '}
                    <span
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer underline"
                        onClick={(event) => {
                            event.stopPropagation();
                            retry();
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                retry();
                            }
                        }}
                    >
                        Coba muat lagi
                    </span>
                </span>
            )}
        </span>
    );
}
