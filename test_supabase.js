import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ipjvgbxkouadovjqwncx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanZnYnhrb3VhZG92anF3bmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTEwODgsImV4cCI6MjA4NzE4NzA4OH0._t52YKSYIjnqFmBycXEkmq3nJnXnVrKB0H3ZD8ju14s'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('businesses')
    .select('*, logs(*), claimer:profiles!businesses_claimed_by_fkey(full_name, email, phone)')
    .not('claimed_by', 'is', null)
    .limit(1)
  
  if (error) {
    console.log('Error businesses_claimed_by_fkey:', error.message)
  } else {
    console.log('Success businesses_claimed_by_fkey:', JSON.stringify(data, null, 2))
  }

  const { data: d2, error: e2 } = await supabase.from('businesses')
    .select('*, logs(*), claimer:profiles!claimed_by(full_name, email, phone)')
    .not('claimed_by', 'is', null)
    .limit(1)
  
  if (e2) {
    console.log('Error claimed_by:', e2.message)
  } else {
    console.log('Success claimed_by:', JSON.stringify(d2, null, 2))
  }
}

test()
