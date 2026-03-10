import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    // ✅ SEC-06 FIX: Dynamic CORS based on request origin
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { phone } = await req.json();

        if (!phone || phone.length < 9) {
            return new Response(
                JSON.stringify({ error: "Invalid phone number" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Normalize phone: ensure it starts with +
        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        // ✅ SEC-07 FIX: Rate limit — max 3 OTP sends per phone per 60 minutes
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        const { data: sendAllowed, error: rlError } = await supabaseAdmin.rpc(
            'check_otp_rate_limit',
            { p_phone: normalizedPhone, p_action: 'send', p_max_attempts: 3, p_window_minutes: 60 }
        );

        if (rlError || !sendAllowed) {
            return new Response(
                JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Generate 6-digit OTP
        // ✅ SEC-05 FIX: Use cryptographic randomness instead of Math.random()
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        const code = String(100000 + (randomBuffer[0] % 900000));
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

        // Store OTP in database (supabaseAdmin client created above for rate limiting)

        const { error: dbError } = await supabaseAdmin
            .from("otp_verifications")
            .upsert(
                { phone: normalizedPhone, code, expires_at: expiresAt, verified: false },
                { onConflict: "phone" }
            );

        if (dbError) {
            console.error("DB upsert error:", dbError);
            throw new Error(`Failed to store OTP: ${dbError.message}`);
        }

        // Send WhatsApp message via Meta Graph API
        const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");
        const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID");
        const templateName = Deno.env.get("META_TEMPLATE_NAME") || "tagdeer_otp";
        const templateLang = Deno.env.get("META_TEMPLATE_LANG") || "ar";

        if (!metaAccessToken || !phoneNumberId) {
            throw new Error("Missing Meta configuration (Token or Phone ID)");
        }

        // Strip the + for Meta API
        const recipientPhone = normalizedPhone.replace("+", "");

        console.log(`Sending WhatsApp OTP to ${recipientPhone} using template ${templateName} (${templateLang})`);

        const metaResponse = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${metaAccessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: recipientPhone,
                    type: "template",
                    template: {
                        name: templateName,
                        language: { code: templateLang },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    { type: "text", text: code }
                                ]
                            },
                            {
                                type: "button",
                                sub_type: "url",
                                index: "0",
                                parameters: [
                                    { type: "text", text: code }
                                ]
                            }
                        ]
                    }
                }),
            }
        );

        const metaResult = await metaResponse.json();

        if (!metaResponse.ok) {
            console.error("Meta API error details:", JSON.stringify(metaResult));
            return new Response(
                JSON.stringify({
                    error: "Meta API rejected the request",
                    meta_error: metaResult,
                    config_used: {
                        phone_id: phoneNumberId,
                        template: templateName,
                        lang: templateLang
                    }
                }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: "OTP sent via WhatsApp" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("Function exception:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Internal function error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
