import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'business_claims' }).catch(() => ({}));
    if (error) {
       console.log("Could not use RPC, querying pg_policies...");
       const { data: policies, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'business_claims');
       if(polErr) console.error(polErr);
       else console.log(JSON.stringify(policies, null, 2));
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}
main()
