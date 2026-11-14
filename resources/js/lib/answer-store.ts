/**
 * Penyimpanan lokal jawaban peserta (IndexedDB) dengan cadangan di memori.
 * Isinya hanya id soal dan id opsi, tidak pernah kunci jawaban.
 */
export type StoredEntry = { o: number | null; t: number }; // t = waktu server (ms) saat dijawab; 0 = berasal dari server

export type SectionRecord = {
    attemptId: number;
    sectionId: number;
    answers: Record<string, StoredEntry>;
    locked: boolean; // true = pilar sudah diselesaikan / waktu habis, menunggu terkirim
    updatedAt: number;
};

type Row = { key: string; record: SectionRecord };

const DB_NAME = 'cod-exam';
const STORE = 'sections';

const memory = new Map<string, SectionRecord>();
let dbPromise: Promise<IDBDatabase> | null = null;
let degraded = false;

const keyOf = (attemptId: number, sectionId: number) => `a${attemptId}:s${sectionId}`;

/** true bila IndexedDB tidak bisa dipakai dan data hanya ada di memori halaman. */
export const isStorageDegraded = () => degraded;

/** Minta browser tidak menghapus data situs ini saat penyimpanan menipis. */
export function requestPersistence(): void {
    try {
        void navigator.storage?.persist?.();
    } catch {
        /* diabaikan */
    }
}

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB tidak tersedia'));
                return;
            }
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }).catch((error) => {
            dbPromise = null; // coba lagi pada operasi berikutnya
            throw error;
        });
    }

    return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();

    return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

export async function putRecord(record: SectionRecord): Promise<void> {
    const key = keyOf(record.attemptId, record.sectionId);
    memory.set(key, record);

    try {
        await withStore('readwrite', (store) => store.put({ key, record } satisfies Row));
        degraded = false;
    } catch {
        degraded = true;
    }
}

export async function getRecord(attemptId: number, sectionId: number): Promise<SectionRecord | null> {
    const key = keyOf(attemptId, sectionId);

    try {
        const row = await withStore<Row | undefined>('readonly', (store) => store.get(key));

        return row?.record ?? memory.get(key) ?? null;
    } catch {
        degraded = true;

        return memory.get(key) ?? null;
    }
}

export async function deleteRecord(attemptId: number, sectionId: number): Promise<void> {
    const key = keyOf(attemptId, sectionId);
    memory.delete(key);

    try {
        await withStore('readwrite', (store) => store.delete(key));
    } catch {
        degraded = true;
    }
}

/** Semua pilar milik attempt ini yang sudah dikunci peserta tetapi belum terkirim, urut dari pilar awal. */
export async function listLocked(attemptId: number): Promise<SectionRecord[]> {
    const prefix = `a${attemptId}:`;
    const merged = new Map<string, SectionRecord>();

    try {
        const rows = await withStore<Row[]>('readonly', (store) => store.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff')));
        rows.forEach((row) => merged.set(row.key, row.record));
    } catch {
        degraded = true;
    }

    memory.forEach((record, key) => {
        if (key.startsWith(prefix)) merged.set(key, record);
    });

    return [...merged.values()].filter((record) => record.locked).sort((a, b) => a.sectionId - b.sectionId);
}