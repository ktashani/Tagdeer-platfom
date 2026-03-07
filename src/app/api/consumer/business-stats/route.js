import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type');

        if (!id || !type || !['recommend', 'complain'].includes(type)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // Fetch current stats
        const { data: business, error: fetchError } = await supabaseAdmin
            .from('businesses')
            .select('recommends, complains')
            .eq('id', id)
            .single();

        if (fetchError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Increment the appropriate counter
        const updates = {};
        if (type === 'recommend') {
            updates.recommends = (business.recommends || 0) + 1;
        } else if (type === 'complain') {
            updates.complains = (business.complains || 0) + 1;
        }

        const { error: updateError } = await supabaseAdmin
            .from('businesses')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            console.error('Error updating business stats:', updateError);
            return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
        }

        return NextResponse.json({ success: true, ...updates });
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
