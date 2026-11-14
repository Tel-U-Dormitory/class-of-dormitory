import { getRecord, putRecord, type SectionRecord, type StoredEntry } from '@/lib/answer-store';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

type State = { answers: Record<string, StoredEntry>; locked: boolean };

type Action =
    | { type: 'answer'; questionId: number; optionId: number | null; t: number }
    | { type: 'hydrate'; record: SectionRecord | null }
    | { type: 'lock' };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'answer':
            if (state.locked) return state;

            return { ...state, answers: { ...state.answers, [action.questionId]: { o: action.optionId, t: action.t } } };

        case 'hydrate': {
            if (!action.record) return state;

            // Yang lebih baru menang. Jawaban dari server punya t = 0, jadi catatan lokal selalu menimpanya.
            const answers = { ...state.answers };
            for (const [questionId, local] of Object.entries(action.record.answers)) {
                const existing = answers[questionId];
                if (!existing || existing.t < local.t) answers[questionId] = local;
            }

            return { answers, locked: state.locked || action.record.locked };
        }

        case 'lock':
            return { ...state, locked: true };
    }
}

/**
 * Jawaban satu pilar: React state + IndexedDB. Tidak ada request ke server per jawaban.
 * Setelah refresh, isi dipulihkan dari IndexedDB dan digabung dengan jawaban dari server.
 */
export function useLocalAnswers(attemptId: number, sectionId: number, serverAnswers: Record<string, number | null>) {
    const [state, dispatch] = useReducer(
        reducer,
        undefined,
        (): State => ({
            answers: Object.fromEntries(Object.entries(serverAnswers).map(([questionId, option]) => [questionId, { o: option, t: 0 }])),
            locked: false,
        }),
    );
    const [ready, setReady] = useState(false);

    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    });

    // Hidrasi: baca catatan lokal sekali saat pilar dibuka.
    useEffect(() => {
        let cancelled = false;

        void getRecord(attemptId, sectionId).then((record) => {
            if (cancelled) return;
            dispatch({ type: 'hydrate', record });
            setReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, [attemptId, sectionId]);

    // Simpan setiap perubahan. Tidak menyimpan sebelum hidrasi selesai agar catatan lokal tidak tertimpa data server.
    useEffect(() => {
        if (!ready) return;

        void putRecord({ attemptId, sectionId, answers: state.answers, locked: state.locked, updatedAt: Date.now() });
    }, [ready, state, attemptId, sectionId]);

    const answers = useMemo(
        () => Object.fromEntries(Object.entries(state.answers).map(([questionId, entry]) => [questionId, entry.o])) as Record<string, number | null>,
        [state.answers],
    );

    const setAnswer = useCallback((questionId: number, optionId: number | null, t: number) => {
        dispatch({ type: 'answer', questionId, optionId, t });
    }, []);

    /** Kunci pilar dan pastikan sudah tertulis ke penyimpanan sebelum pengiriman dimulai. */
    const lockAndPersist = useCallback(async () => {
        dispatch({ type: 'lock' });

        await putRecord({ attemptId, sectionId, answers: stateRef.current.answers, locked: true, updatedAt: Date.now() });
    }, [attemptId, sectionId]);

    return { answers, locked: state.locked, ready, setAnswer, lockAndPersist };
}