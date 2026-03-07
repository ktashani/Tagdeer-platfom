import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '0ab8bb57-a80d-4d7f-afb6-ff13fe2eb65f'; // CORRECT BUSINESS ID

const run = async () => {
    // 1. Get the current owner so we can restore it later
    const { data: biz } = await supabaseAdmin.from('businesses').select('claimed_by').eq('id', businessId).single();
    if (!biz || !biz.claimed_by) {
        console.log("No owner found for business, cannot test proper RLS via owner swap.");
        return;
    }
    const originalOwnerId = biz.claimed_by;
    console.log("Original Business Owner ID:", originalOwnerId);

    // 2. Sign in as our test user (we created this earlier)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
        email: 'test_upsert_rls@example.com',
        password: 'password123'
    });

    if (authErr) {
        console.error("Failed to sign in test user:", authErr);
        return;
    }

    const testUserId = authData.user.id;
    console.log("Test User ID:", testUserId);

    // 3. Swap the business owner to the test user!
    console.log("Swapping owner...");
    await supabaseAdmin.from('businesses').update({ claimed_by: testUserId }).eq('id', businessId);

    // 4. Run the UPSERT as the Test User!
    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    console.log("=== TESTING RLS PATH (SHOULD BE ALLOWED) ===");
    const payload = {
        business_id: businessId,
        slug: 'test-new-2-hang-test-auth-success',
        status: 'draft',
    };

    let start = Date.now();
    try {
        const { data, error } = await supabaseAuth.from('storefronts').upsert(payload, { onConflict: 'business_id', ignoreDuplicates: false });
        console.log("Auth Result:", error ? "Error " + error.code + " " + error.message : "Success!", data);
    } catch (e) {
        console.log("Auth Caught Exception:", e);
    }
    console.log("Auth Time:", Date.now() - start, "ms");

    // 5. Restore the original owner!
    console.log("Restoring original owner...");
    await supabaseAdmin.from('businesses').update({ claimed_by: originalOwnerId }).eq('id', businessId);
    console.log("Done.");
}
run();
