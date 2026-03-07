import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const { item_id, fingerprint, reaction } = await req.json();

        if (!item_id || !fingerprint || !['like', 'dislike'].includes(reaction)) {
            return NextResponse.json({ error: 'Invalid parameters. Required: item_id, fingerprint, reaction (like|dislike)' }, { status: 400 });
        }

        // Upsert reaction (one per device per item, updates if already voted)
        const { error: reactErr } = await supabase
            .from('catalog_reactions')
            .upsert(
                { item_id, fingerprint, reaction },
                { onConflict: 'item_id,fingerprint' }
            );

        if (reactErr) {
            console.error('Reaction upsert error:', reactErr);
            return NextResponse.json({ error: reactErr.message }, { status: 500 });
        }

        // Recount totals
        const { count: likes } = await supabase
            .from('catalog_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('item_id', item_id)
            .eq('reaction', 'like');

        const { count: dislikes } = await supabase
            .from('catalog_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('item_id', item_id)
            .eq('reaction', 'dislike');

        // Update denormalized counts on the item
        await supabase.from('catalog_items').update({ likes, dislikes }).eq('id', item_id);

        return NextResponse.json({ likes: likes || 0, dislikes: dislikes || 0, voted: reaction });
    } catch (err) {
        console.error('Catalog react error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
