import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/serverAuth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        // ✅ SEC-01 FIX: Require authenticated user
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type');

        if (!id || !type || !['recommend', 'complain'].includes(type)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // ✅ BUG-01 FIX: Atomic increment via RPC (prevents read-modify-write race)
        const column = type === 'recommend' ? 'recommends' : 'complains';
        const { error: rpcError } = await supabaseAdmin.rpc('increment_business_stat', {
            p_business_id: id,
            p_column: column,
        });

        if (rpcError) {
            console.error('RPC error:', rpcError);
            // If the RPC fails because the business doesn't exist, return 404
            if (rpcError.message?.includes('does not exist') || rpcError.code === 'PGRST116') {
                return NextResponse.json({ error: 'Business not found' }, { status: 404 });
            }
            return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
