export interface Log {
    type: string; // 'recommend' | 'complain'
    trust_points?: number | null;
    is_verified?: boolean;
}

export function calculateBusinessScore(logs: Log[]): {
    healthScore: number,
    weightedRecommends: number,
    weightedComplains: number,
    rawRecommends: number,
    rawComplains: number
} {
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
    const healthScore = totalWeighted === 0 ? 0 : Math.round((p / totalWeighted) * 100);

    return {
        healthScore,
        weightedRecommends: Number(p.toFixed(2)),
        weightedComplains: Number(n.toFixed(2)),
        rawRecommends: rawP,
        rawComplains: rawN
    };
}
