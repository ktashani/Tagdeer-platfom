import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const { businessId, campaignId, userId } = body;

        if (!businessId || !campaignId || !userId) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        // Use service role to bypass RLS and auth.uid() restrictions
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Verify business ownership
        const { data: business, error: bErr } = await supabase
            .from('businesses')
            .select('claimed_by')
            .eq('id', businessId)
            .single();

        if (bErr || !business) {
            return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
        }

        console.log(`[Trial Claim] Comparing business.claimed_by: ${business.claimed_by} to userId: ${userId}`);

        if (business.claimed_by !== userId) {
            return NextResponse.json({ success: false, error: `You do not own this business (Expected: ${business.claimed_by}, Received: ${userId})` }, { status: 403 });
        }

        // 2. Lock/Fetch Campaign Details
        const { data: campaign, error: cErr } = await supabase
            .from('trial_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (cErr || !campaign) return NextResponse.json({ success: false, error: 'Campaign not found' });
        if (!campaign.is_active) return NextResponse.json({ success: false, error: 'This trial campaign is no longer active' });
        if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) return NextResponse.json({ success: false, error: 'This trial campaign has expired' });
        if (campaign.current_redemptions >= campaign.max_redemptions) return NextResponse.json({ success: false, error: 'This trial campaign has reached its redemption limit' });

        // 3. Check if already redeemed
        const { data: existingRedemption } = await supabase
            .from('trial_campaign_redemptions')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('business_id', businessId)
            .single();

        if (existingRedemption) {
            return NextResponse.json({ success: false, error: 'Your business has already claimed this trial' });
        }

        // 4. Check existing active subscription
        const { data: currentSub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('profile_id', userId)
            .single();

        // If it's a Tier Upgrade, they cannot overwrite a paid plan.
        if (campaign.campaign_type !== 'addon_grant' && currentSub && (currentSub.status === 'Active' || currentSub.status === 'Pending')) {
            if (!currentSub.is_trial) {
                return NextResponse.json({ success: false, error: 'Active paid subscriptions cannot be replaced by a free trial tier. Only Addon Trials are allowed.' });
            }
        }

        // 5. Calculate expiry
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + campaign.trial_months);

        // 6. Execute Updates

        // A. Register Redemption
        await supabase.from('trial_campaign_redemptions').insert({
            campaign_id: campaignId,
            business_id: businessId
        });

        // B. Increment Usage
        await supabase.from('trial_campaigns')
            .update({ current_redemptions: campaign.current_redemptions + 1 })
            .eq('id', campaignId);


        if (campaign.campaign_type === 'addon_grant') {
            // C. Insert Addon token for each addon array item
            const addonsToGrant = Array.isArray(campaign.addons) ? campaign.addons : [];
            const addonInserts = addonsToGrant.map(addon => {
                const typestr = typeof addon === 'string' ? addon : addon.type;
                const qty = typeof addon === 'object' && addon.quantity ? addon.quantity : 1;
                return {
                    profile_id: userId,
                    addon_type: typestr,
                    quantity: qty,
                    status: 'active',
                    expires_at: expiresAt.toISOString()
                }
            });

            if (addonInserts.length > 0) {
                await supabase.from('merchant_addons').insert(addonInserts);
            }

            return NextResponse.json({
                success: true,
                message: `Successfully claimed feature trial addon for ${campaign.trial_months} months!`,
                expires_at: expiresAt
            });
        } else {
            // C. Upsert Base Subscription Tier
            const subPayload = {
                profile_id: userId,
                tier: campaign.tier,
                status: 'Active',
                expires_at: expiresAt.toISOString(),
                is_trial: true,
                trial_months: campaign.trial_months
            };

            if (currentSub) {
                await supabase.from('subscriptions').update(subPayload).eq('profile_id', userId);
            } else {
                await supabase.from('subscriptions').insert(subPayload);
            }

            return NextResponse.json({
                success: true,
                message: `Successfully claimed ${campaign.tier} trial for ${campaign.trial_months} months!`,
                expires_at: expiresAt
            });
        }

    } catch (err) {
        console.error('Trial claim exception:', err);
        return NextResponse.json({ success: false, error: 'Internal server error while claiming trial' }, { status: 500 });
    }
}
