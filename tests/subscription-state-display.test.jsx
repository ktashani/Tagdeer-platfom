import { describe, it, expect } from 'vitest';

describe('Subscription Status Badges', () => {
    const STATUS_BADGES = {
        'Active': { label: 'Active', class: 'bg-emerald-100 text-emerald-700' },
        'Expiring Soon': { label: 'Expiring Soon', class: 'bg-amber-100 text-amber-700' },
        'Grace Period': { label: 'Grace Period', class: 'bg-red-100 text-red-700' },
        'Pending': { label: 'Awaiting Payment', class: 'bg-blue-100 text-blue-700' },
        'Suspended': { label: 'Suspended', class: 'bg-red-100 text-red-700' },
        'Terminated': { label: 'Terminated', class: 'bg-slate-100 text-slate-700' }
    };

    it('should map all valid subscription states to badge configs', () => {
        const validStates = ['Active', 'Expiring Soon', 'Grace Period', 'Pending', 'Suspended', 'Terminated'];
        validStates.forEach(status => {
            expect(STATUS_BADGES[status]).toBeDefined();
            expect(STATUS_BADGES[status].label).toBeTruthy();
            expect(STATUS_BADGES[status].class).toBeTruthy();
        });
    });

    it('should not have a badge for Expired (reverts to Free)', () => {
        expect(STATUS_BADGES['Expired']).toBeUndefined();
    });
});
