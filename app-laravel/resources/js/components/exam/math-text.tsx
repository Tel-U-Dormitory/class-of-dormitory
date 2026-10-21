import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/**
 * Teks soal dengan dukungan LaTeX. Segmen di antara $...$ dirender sebagai rumus;
 * jika tidak ada pembatas, seluruh teks dianggap rumus.
 */
export function MathText({ text, latex, className }: { text: string; latex: boolean; className?: string }) {
    const html = useMemo(() => {
        if (!latex) return null;

        const render = (tex: string, displayMode = false) => katex.renderToString(tex, { throwOnError: false, displayMode });

        if (!text.includes('$')) return render(text, true);

        return text
            .split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
            .map((part) => {
                if (part.startsWith('$$')) return render(part.slice(2, -2), true);
                if (part.startsWith('$')) return render(part.slice(1, -1));
                return part.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
            })
            .join('');
    }, [text, latex]);

    if (html === null) return <div className={className}>{text}</div>;

    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
