import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Dequeue pending ERP events (for external polling by Odoo)
export async function GET(request) {
    // Verify admin authorization
    const authHeader = request.headers.get('Authorization');
    const expectedKey = process.env.ERP_SYNC_API_KEY;

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50');

    const { data, error } = await supabase
        .from('erp_sync_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data, count: data.length });
}

// POST: Mark events as synced (called by Odoo after processing)
export async function POST(request) {
    const authHeader = request.headers.get('Authorization');
    const expectedKey = process.env.ERP_SYNC_API_KEY;

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { event_ids, status = 'synced' } = body;

        if (!Array.isArray(event_ids) || event_ids.length === 0) {
            return NextResponse.json({ error: 'event_ids array is required' }, { status: 400 });
        }

        const updates = {
            status: status,
            synced_at: status === 'synced' ? new Date().toISOString() : null,
            sync_attempts: undefined // Will be incremented below
        };

        // Increment attempt count and update status
        for (const eventId of event_ids) {
            await supabase
                .from('erp_sync_queue')
                .update({
                    status: status,
                    synced_at: status === 'synced' ? new Date().toISOString() : null,
                    sync_attempts: supabase.rpc ? undefined : 1 // Fallback
                })
                .eq('id', eventId);

            // Increment sync_attempts using raw SQL if needed
            await supabase.rpc('increment_sync_attempt', { p_event_id: eventId }).catch(() => {
                // RPC may not exist yet, that's OK
            });
        }

        return NextResponse.json({
            success: true,
            processed: event_ids.length
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
