import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We need the ANON key to call the edge function (it doesn't need service role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RECIPIENT_PHONE = '+905398539275'; // Test phone

async function testEdgeFunction() {
    console.log(`Sending WhatsApp OTP via Edge Function to ${RECIPIENT_PHONE}...`);

    try {
        const { data, error } = await supabase.functions.invoke('whatsapp-otp-send', {
            body: { phone: RECIPIENT_PHONE }
        });

        if (error) {
            console.error('Edge Function HTTP Error:', error.message);
            if (error.context && typeof error.context.text === 'function') {
                const text = await error.context.text();
                console.error('Edge Function Error Body:', text);
            }
            return;
        }

        if (data && data.error) {
            console.error('Edge Function returned internal error:', data.error);
        } else {
            console.log('\n✅ SUCCESS! Edge Function triggered successfully.');
            console.log('Response:', data);
        }

    } catch (e) {
        console.error('Network Error:', e);
    }
}

testEdgeFunction();
