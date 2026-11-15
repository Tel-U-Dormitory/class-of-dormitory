export interface SubmissionReceipt {
    accepted: number;
    rejected: number[];
}

// HTTP 200 alone is not proof that every answer was accepted.
export function fullyAccepted(receipt: unknown, expected: number): receipt is SubmissionReceipt {
    if (receipt === null || typeof receipt !== 'object') return false;
    const value = receipt as Partial<SubmissionReceipt>;
    return value.accepted === expected && Array.isArray(value.rejected) && value.rejected.length === 0;
}
