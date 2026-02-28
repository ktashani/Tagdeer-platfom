import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers })
    }

    try {
        const { phone, code } = await req.json()
        if (!phone || !code) throw new Error("Phone and code are required")

        // TODO: Verify via Twilio
        // const verificationCheck = await client.verify.v2.services(...).verificationChecks.create({to: phone, code});
        // if (verificationCheck.status !== 'approved') throw new Error("Invalid code")

        // Simulated bypass for tests
        const isMockAuth = code === '999999'

        if (!isMockAuth) {
            // Implement real check here
            console.log("Validating real OTP against provider...");
        }

        // Connect to Supabase to fetch or create profile
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        // Fallback response for missing variables
        if (!supabaseUrl || !supabaseKey) {
            return new Response(
                JSON.stringify({
                    success: true,
                    profile: { phone, user_id: 'local-dev-mock-uuid', gader_points: 20 },
                    isNewUser: false
                }),
                { headers: { "Content-Type": "application/json" } }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Lookup profile
        let { data: profile, error: selectErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', phone)
            .single()

        let isNewUser = false;

        if (!profile) {
            // Missing profile; create it
            const mockUserId = `VIP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

            const { data: newProfile, error: insertErr } = await supabase
                .from('profiles')
                .insert([{ phone, user_id: mockUserId, gader_points: 20, vip_tier: 'Bronze' }])
                .select()
                .single()

            if (insertErr) throw new Error("Error creating profile")
            profile = newProfile
            isNewUser = true;
        }

        return new Response(
            JSON.stringify({ success: true, profile, isNewUser }),
            { headers: { "Content-Type": "application/json" } },
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
