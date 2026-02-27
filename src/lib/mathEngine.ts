export interface Log {
    type: string; // 'recommend' | 'complain'
    trust_points?: number | null;
    is_verified?: boolean;
}

export interface ScoreResult {
    rawRecommends: number;
    rawComplains: number;
    gaderIndex: number;
    decayFactor: number; // Assuming this will be calculated or passed
    confidenceLevel: number; // Assuming this will be calculated or passed
}

export function calculateBusinessScore(logs: Log[]): ScoreResult {
    let p = 0;
    let n = 0;
    let rawP = 0;
    let rawN = 0;

    logs.forEach(log => {
        let weight = 1;
        if (log.is_verified && log.trust_points !== undefined && log.trust_points !== null) {
            weight = 1 + (log.trust_points / 1000);
        }

        if (log.type === 'recommend') {
            p += weight;
            rawP += 1;
        } else if (log.type === 'complain') {
            n += weight;
            rawN += 1;
        }
    });

    const totalWeighted = p + n;
    // 5. Business Health Score (The "Gader Index")
    // Formula: (Positive Weighted Logs / Total Weighted Logs) * 100
    // If no logs, score is 0.
    const gaderIndex = totalWeighted === 0 ? 0 : Math.round((p / totalWeighted) * 100);

    // Placeholder values for decayFactor and confidenceLevel as their calculation logic is not provided
    // You would need to implement the actual calculation for these based on your business logic.
    const activeDecayFactor = 1.0; // Example placeholder
    const confidenceLevel = 0.5; // Example placeholder

    return {
        rawRecommends: rawP,
        rawComplains: rawN,
        gaderIndex,
        decayFactor: Math.round(activeDecayFactor * 100) / 100,
        confidenceLevel
    };
}
