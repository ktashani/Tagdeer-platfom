import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use the CORRECT business ID this time!
const businessId = '0ab8bb57-a80d-4d7f-afb6-ff13fe2eb65f';

const run = async () => {
    // 1. Get the owner of this business
    const { data: biz } = await supabaseAdmin.from('businesses').select('claimed_by').eq('id', businessId).single();
    if (!biz || !biz.claimed_by) {
        console.log("No owner found for business");
        return;
    }
    const ownerId = biz.claimed_by;
    console.log("Business Owner ID:", ownerId);

    // 2. We can't generate a JWT for a specific user without a custom JWT signer or password.
    // However, I can temporarily test the RLS policy by looking at the exact SQL.
    console.log("Looking at the RLS policy. If the user is the owner, does it hang?");
}
run();
