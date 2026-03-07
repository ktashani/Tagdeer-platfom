import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

const test = async () => {
    console.log("Testing fake table...");
    try {
        const { data, error } = await client.from('nonexistent_table_123').upsert({ id: 1 });
        console.log("Result:", { data, error });
    } catch(e) {
        console.error("Caught:", e);
    }
}
test();
