import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need to use a real logged-in user to hit the RLS policy correctly, as ANON will just be rejected by auth.uid() check
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb66f';

const run = async () => {
    // Generate a test user and JWT to simulate authenticated RLS check
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'test_upsert_rls@example.com',
      password: 'password123',
      email_confirm: true
    });
    
    if (userError && userError.status !== 422) {
      console.log("Create user error", userError);
      return;
    }

    const { data: authData } = await supabaseAdmin.auth.signInWithPassword({
        email: 'test_upsert_rls@example.com',
        password: 'password123'
    });

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    console.log("Testing with Authenticated User key...");
    const payload = {
        business_id: businessId, // invalid
        slug: 'test-new-2-hang-test-authenticated',
        status: 'draft',
    };
    
    const start = Date.now();
    try {
        const { data, error } = await supabaseAuth.from('storefronts').upsert(payload, { onConflict: 'business_id', ignoreDuplicates: false });
        console.log("Result:", error ? "Error " + error.code : "Success", error?.message);
    } catch(e) {
        console.log("Caught:", e);
    }
    console.log("Time:", Date.now() - start, "ms");
}
run();
