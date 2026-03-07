import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const body = await req.json();
        const { business_id, interaction_type, reason_text } = body;

        if (!business_id || !interaction_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['recommend', 'complain'].includes(interaction_type)) {
            return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('consumer_logs')
            .insert({
                business_id,
                interaction_type,
                reason_text: reason_text || null,
                source: 'storefront_inline'
            })
            .select()
            .single();

        if (error) {
            console.error('Error inserting log:', error);
            return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
