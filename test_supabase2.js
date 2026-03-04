import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('businesses')
    .select('*, logs(*)')
    .not('claimed_by', 'is', null)
    .limit(1)
  
  if (error) {
    console.log('Error getting claimed business:', error.message)
  } else {
    console.log('Success getting claimed business:', JSON.stringify(data, null, 2))
    if (data && data.length > 0) {
      console.log('Owner ID:', data[0].claimed_by)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data[0].claimed_by)
        .single()
      console.log('Profile:', { profileData, profileError })
    }
  }
}

test()
