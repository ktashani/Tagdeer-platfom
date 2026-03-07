import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '0ab8bb57-a80d-4d7f-afb6-ff13fe2eb65f'; // CORRECT BUSINESS ID
// Owner is 7bde6b8c-d710-4f62-93db-9d5b0738a573

const run = async () => {
    // Generate a test user, but wait! We can't act as the owner unless we know their password, 
    // BUT we CAN use the admin client to bypass auth, issue a JWT for the owner's UUID, and use that!
    // Supabase JS doesn't natively expose "SignInAsUser(uuid)" but we can just use the admin client 
    // to do the exact same upsert to see if admin hangs. If admin doesn't hang, RLS is the culprit.
    
    console.log("Testing with ADMIN key on CORRECT ID...");
    const payload = {
        business_id: businessId, 
        slug: 'test-new-2-hang-test-admin',
        status: 'draft',
    };
    
    let start = Date.now();
    try {
        const { data, error } = await supabaseAdmin.from('storefronts').upsert(payload, { onConflict: 'business_id', ignoreDuplicates: false });
        console.log("Admin Result:", error ? "Error " + error.code : "Success", error?.message);
    } catch(e) {
        console.log("Admin Caught:", e);
    }
    console.log("Admin Time:", Date.now() - start, "ms");
}
run();
