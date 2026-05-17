import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

/**
 * GET /api/client-ip — Returns a HASHED version of the caller's IP.
 * 
 * LEGAL SAFETY: We never send the raw IP to the client.
 * The hash uses a daily-rotating salt so:
 * - Same IP on same day = same hash (spam detection still works)
 * - Same IP on different days = different hash (long-term tracing impossible)
 * 
 * When a lawyer asks "give us the user's IP", we can truthfully say:
 * "We do not store IP addresses. We store one-way cryptographic hashes
 * used for spam prevention that cannot be reversed to identify individuals."
 */
export async function GET(req) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
    
    // Daily-rotating salt: today's date + server-side secret
    const dailySalt = new Date().toISOString().split('T')[0] + (process.env.IP_HASH_SECRET || 'tagdeer-default-salt');
    const ipHash = createHash('sha256').update(ip + dailySalt).digest('hex');
    
    return NextResponse.json({ ip: ipHash });
}
