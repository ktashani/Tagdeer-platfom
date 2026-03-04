import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function setMockerOwner() {
  const { data: businesses, error } = await supabase.from('businesses')
    .select('*, logs(*)')
    .eq('name', 'Al-Madina Tech')
    .limit(1)
  
  if (businesses && businesses.length > 0) {
      const b = businesses[0];
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) {
          const ownerId = profiles[0].id;
          await supabase.from('businesses').update({ claimed_by: ownerId }).eq('id', b.id);
          console.log('Set owner of Al-Madina Tech to', ownerId);
      }
  }
}

setMockerOwner()
