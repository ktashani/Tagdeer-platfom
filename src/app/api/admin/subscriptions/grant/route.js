import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
    try {
        const body = await req.json();
        const { profileId, tier, months } = body;

        if (!profileId || !tier || !months) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Fetch dynamic tier quotas from platform_config
        const { data: configData, error: configError } = await supabase
            .from('platform_config')
            .select('value')
            .eq('key', 'tier_pricing')
            .single();

        let quotas = { max_locations: 1, max_shields: 0, max_campaigns: 0, gader_points: 5 };

        if (!configError && configData?.value) {
            const tiers = configData.value;
            const targetTierInfo = tiers.find(t => t.name.toLowerCase() === tier.toLowerCase());
            if (targetTierInfo && targetTierInfo.allocations) {
                quotas = targetTierInfo.allocations;
            } else {
                console.warn(`Tier '${tier}' allocations not found in config. Using fallback quotas.`);
            }
        }

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));

        const payload = {
            profile_id: profileId,
            tier: tier,
            status: 'Active',
            is_trial: true,
            trial_months: months,
            expires_at: expiryDate.toISOString(),
            auto_renew: false,
            quotas: quotas,
            addons: []
        };

        const { data: existing } = await supabase.from('subscriptions').select('id').eq('profile_id', profileId).maybeSingle();

        let result;
        if (existing) {
            result = await supabase.from('subscriptions').update(payload).eq('id', existing.id);
        } else {
            result = await supabase.from('subscriptions').insert(payload);
        }

        if (result.error) {
            console.error('Subscription grant error:', result.error);
            return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: result.data });
    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
