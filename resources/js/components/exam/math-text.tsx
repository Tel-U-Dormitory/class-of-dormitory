import { lazy, Suspense } from 'react';

const MathRenderer = lazy(() => import('./math-renderer'));

/** Load the formula renderer only when a question actually contains LaTeX. */
export function MathText({ text, latex, className }: { text: string; latex: boolean; className?: string }) {
    const plainText = <div className={className}>{text}</div>;
    if (!latex) return plainText;

    return (
        <Suspense fallback={plainText}>
            <MathRenderer text={text} latex={latex} className={className} />
        </Suspense>
    );
}
