import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
    try {
        const body = await req.json();
        const { profileId } = body;

        if (!profileId) {
            return NextResponse.json({ success: false, error: 'Missing profile ID' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Delete the trial subscription (reverting them to free tier implicitly since we decouple)
        const { error } = await supabase
            .from('subscriptions')
            .delete()
            .eq('profile_id', profileId)
            .eq('is_trial', true);

        if (error) {
            console.error('Subscription revoke error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Feature allocations are automatically deleted if the foreign key deletes? No, they are referenced to profiles.
        // We should revoke all feature allocations if they are reverted to free tier.
        const { error: fError } = await supabase
            .from('feature_allocations')
            .update({ status: 'revoked' })
            .eq('profile_id', profileId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
