import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId1 = '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb66f'; 
const businessId2 = '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb65f'; 
const businessId3 = '0ab8bb57-a80d-4d7f-afb6-ff13fe2eb65f';

const run = async () => {
    const res1 = await supabaseAdmin.from('businesses').select('id, name').eq('id', businessId1);
    const res2 = await supabaseAdmin.from('businesses').select('id, name').eq('id', businessId2);
    const res3 = await supabaseAdmin.from('businesses').select('id, name').eq('id', businessId3);
    
    console.log("67...66f:", res1.data);
    console.log("67...65f:", res2.data);
    console.log("57...65f:", res3.data);
}
run();
