import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { phone, code } = await req.json();

        if (!phone || !code || code.length !== 6) {
            return new Response(
                JSON.stringify({ error: "Phone and 6-digit code are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Step 1: Check OTP in database
        const { data: otpRecord, error: selectErr } = await supabaseAdmin
            .from("otp_verifications")
            .select("*")
            .eq("phone", normalizedPhone)
            .eq("code", code)
            .eq("verified", false)
            .gt("expires_at", new Date().toISOString())
            .single();

        if (selectErr || !otpRecord) {
            return new Response(
                JSON.stringify({ error: "Invalid or expired code" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Step 2: Mark OTP as verified
        await supabaseAdmin
            .from("otp_verifications")
            .update({ verified: true })
            .eq("id", otpRecord.id);

        // Step 3: Check/create profile in public.profiles
        let isNewUser = false;
        let { data: profile, error: profileErr } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("phone", normalizedPhone)
            .single();

        if (profileErr && profileErr.code === "PGRST116") {
            // No profile found — create one with +500 welcome bonus
            isNewUser = true;
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();

            const { data: newProfile, error: insertErr } = await supabaseAdmin
                .from("profiles")
                .insert([{
                    phone: normalizedPhone,
                    user_id: `VIP-${randomAlphanumeric}`,
                    gader_points: 20,
                    vip_tier: "Bronze"
                }])
                .select()
                .single();

            if (insertErr) {
                console.error("Error creating profile:", insertErr);
                return new Response(
                    JSON.stringify({ error: "Failed to create user profile" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            profile = newProfile;
        } else if (profileErr) {
            console.error("Error fetching profile:", profileErr);
            return new Response(
                JSON.stringify({ error: "Database error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Step 4: Return the profile + isNewUser flag
        // The client will use this to set their local user state
        return new Response(
            JSON.stringify({
                success: true,
                isNewUser,
                profile: {
                    id: profile.id,
                    phone: profile.phone,
                    user_id: profile.user_id,
                    gader_points: profile.gader_points,
                    vip_tier: profile.vip_tier,
                    full_name: profile.full_name,
                    city: profile.city,
                    gender: profile.gender,
                    birth_date: profile.birth_date,
                }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("Function error:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
