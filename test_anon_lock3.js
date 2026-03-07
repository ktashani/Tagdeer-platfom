import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '0ab8bb57-a80d-4d7f-afb6-ff13fe2eb65f'; // CORRECT ID

const run = async () => {
    // We already created 'test_upsert_rls@example.com' in the DB.
    // Let's sign in again.
    const { data: authData } = await supabaseAdmin.auth.signInWithPassword({
        email: 'test_upsert_rls@example.com',
        password: 'password123'
    });

    // Wait, the business `0ab8bb57` is owned by `7bde6b8c-d710-4f62-93db-9d5b0738a573`.
    // The test user won't own it, so it SHOULD just fail RLS instantly.
    // But does it hang??? Let's see!
    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    console.log("Testing with Authenticated User key on CORRECT ID...");
    const payload = {
        business_id: businessId, 
        slug: 'test-new-2-hang-test-authenticated-3',
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
