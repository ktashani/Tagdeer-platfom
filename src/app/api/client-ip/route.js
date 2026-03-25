import { NextResponse } from 'next/server';

/**
 * GET /api/client-ip — Returns the caller's IP address.
 * Used by VoteModal to pass IP to the record_anon_vote RPC
 * for secondary rate limiting.
 */
export async function GET(req) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
    return NextResponse.json({ ip });
}
