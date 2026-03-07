import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const run = async () => {
    // Let's get "test new 2" business ID specifically
    const { data: b1 } = await supabaseAdmin.from('businesses').select('*').ilike('name', '%test new 2%');
    console.log("Businesses named 'test new 2':", b1);
    
    // Let's get all feature allocations for "test new 2"
    if (b1 && b1.length > 0) {
        const { data: a1 } = await supabaseAdmin.from('feature_allocations').select('*').eq('business_id', b1[0].id);
        console.log("Feature Allocations for", b1[0].id, ":", a1);
    }

    // Let's query the ID from the screenshot directly with no ilike
    const b2 = await supabaseAdmin.from('businesses').select('*').eq('id', '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb65f');
    console.log("Direct query for 67...65f:", b2.data);
}
run();
