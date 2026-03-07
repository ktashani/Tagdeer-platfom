import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const businessId = '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb66f';

const run = async () => {
    console.log("Testing with ANON key...");
    const payload = {
        business_id: businessId,
        slug: 'test-new-2-hang-test-anon',
        status: 'draft',
    };
    
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('storefronts').upsert(payload, { onConflict: 'business_id' });
        console.log("Result:", error ? "Error " + error.code : "Success");
    } catch(e) {
        console.log("Caught:", e);
    }
    console.log("Time:", Date.now() - start, "ms");
}
run();
