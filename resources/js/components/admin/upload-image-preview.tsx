import { useEffect, useState } from 'react';

export function UploadImagePreview({ file }: { file: File }) {
    const [url, setUrl] = useState<string>();
    useEffect(() => {
        const value = URL.createObjectURL(file);
        setUrl(value);
        return () => URL.revokeObjectURL(value);
    }, [file]);
    return (
        <span className="block">
            {url && <img src={url} alt="Pratinjau gambar pilihan" className="max-h-48 max-w-full object-contain" />}
            <span className="text-muted-foreground block text-xs">
                {file.name} · {(file.size / 1024).toFixed(1)} KB · Optimasi lossless dilakukan saat disimpan.
            </span>
        </span>
    );
}
