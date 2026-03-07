require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('storefronts').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
  
  if (error?.message?.includes('schema cache')) {
     console.log('Attempting cache reload...');
     const { error: rpcError } = await supabase.rpc('reload_schema');
     console.log('Reload error:', rpcError);
  }
}
test();
