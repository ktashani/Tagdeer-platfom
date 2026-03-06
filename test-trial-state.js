import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testQuery() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, businesses(id, name), subscriptions(*)')
        .limit(5);

    console.log(JSON.stringify({ data, error }, null, 2));
}

testQuery();
