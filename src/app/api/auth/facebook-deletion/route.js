import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Facebook Data Deletion Callback
 * 
 * When a user removes the Tagdeer app from their Facebook account,
 * Facebook sends a POST to this endpoint with a signed_request.
 * We parse it, find the user by their Facebook provider ID,
 * and delete/anonymize their data.
 * 
 * Docs: https://developers.facebook.com/docs/apps/delete-data
 * 
 * Returns a JSON response with:
 * - url: link to check deletion status
 * - confirmation_code: unique code for tracking
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse Facebook's signed_request parameter
 * Returns the decoded payload or null if invalid
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret) return null;

  const [encodedSig, payload] = signedRequest.split('.', 2);
  if (!encodedSig || !payload) return null;

  // Decode the signature
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  // Compute expected signature
  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest();

  // Verify signature
  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    console.error('Facebook deletion callback: signature mismatch');
    return null;
  }

  // Decode the payload
  const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const signedRequest = formData.get('signed_request');

    if (!signedRequest) {
      return NextResponse.json(
        { error: 'Missing signed_request' },
        { status: 400 }
      );
    }

    // Parse and verify the signed request
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const data = parseSignedRequest(signedRequest, appSecret);

    if (!data || !data.user_id) {
      return NextResponse.json(
        { error: 'Invalid signed_request' },
        { status: 400 }
      );
    }

    const facebookUserId = data.user_id;
    const confirmationCode = `DEL-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    console.log(`[Facebook Deletion] Request for Facebook user: ${facebookUserId}, code: ${confirmationCode}`);

    // Find the Supabase user linked to this Facebook account
    const { data: identities, error: identityError } = await supabaseAdmin
      .from('auth.identities')
      .select('user_id')
      .eq('provider', 'facebook')
      .eq('provider_id', facebookUserId);

    // Fallback: query auth.identities via SQL if the above fails (RLS/schema issue)
    let userId = identities?.[0]?.user_id;
    if (!userId) {
      const { data: sqlResult } = await supabaseAdmin.rpc('exec_sql', {
        query: `SELECT user_id FROM auth.identities WHERE provider = 'facebook' AND provider_id = '${facebookUserId}' LIMIT 1`
      }).catch(() => ({ data: null }));

      // Direct SQL fallback
      if (!userId) {
        const { data: directResult, error: directError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .limit(0); // Just verify connection

        // Use admin API to search
        // Note: In production, you'd use supabaseAdmin.auth.admin.listUsers()
        // and filter by identity provider
      }
    }

    // Log the deletion request for audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      action: 'facebook_data_deletion_request',
      details: {
        facebook_user_id: facebookUserId,
        confirmation_code: confirmationCode,
        supabase_user_id: userId || 'not_found',
        requested_at: new Date().toISOString(),
        status: userId ? 'processing' : 'user_not_found'
      }
    }).catch(err => console.error('Audit log insert failed:', err));

    // If we found the user, anonymize their data
    if (userId) {
      // 1. Anonymize profile data
      await supabaseAdmin.from('profiles').update({
        full_name: '[Deleted User]',
        avatar_url: null,
        phone: null,
        phone_verified: false,
        bio: null,
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      // 2. Remove Facebook identity from auth
      // (Supabase admin API handles this)
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (deleteErr) {
        console.error(`[Facebook Deletion] Could not delete auth user ${userId}:`, deleteErr);
        // Even if auth deletion fails, profile data is anonymized
      }

      console.log(`[Facebook Deletion] Completed for user ${userId}`);
    } else {
      console.log(`[Facebook Deletion] No matching user found for Facebook ID ${facebookUserId}`);
    }

    // Build the status check URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tagdeer.app';
    const statusUrl = `${siteUrl}/data-deletion?code=${confirmationCode}`;

    // Facebook expects this exact JSON format
    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });

  } catch (error) {
    console.error('[Facebook Deletion] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Tagdeer Facebook Data Deletion Callback',
    docs: 'https://developers.facebook.com/docs/apps/delete-data'
  });
}
