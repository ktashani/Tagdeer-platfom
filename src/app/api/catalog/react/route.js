import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * In-memory sliding-window rate limiter.
 * Max 20 reactions per IP per 60-second window.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
        rateLimitMap.set(ip, recent);
        return true;
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);
    return false;
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap) {
        const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, recent);
        }
    }
}, 5 * 60_000);

export async function POST(req) {
    try {
        // Rate limiting by IP
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headersList.get('x-real-ip')
            || 'unknown';

        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { item_id, fingerprint, reaction } = await req.json();

        if (!item_id || !fingerprint || !['like', 'dislike'].includes(reaction)) {
            return NextResponse.json({ error: 'Invalid parameters. Required: item_id, fingerprint, reaction (like|dislike)' }, { status: 400 });
        }

        // Validate fingerprint format
        if (typeof fingerprint !== 'string' || fingerprint.length === 0 || fingerprint.length > 128) {
            return NextResponse.json({ error: 'Invalid fingerprint format' }, { status: 400 });
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
