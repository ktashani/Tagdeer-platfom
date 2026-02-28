import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import twilio or other SDK here

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers })
    }

    try {
        const { phone } = await req.json()

        if (!phone) throw new Error("Phone number is required")

        // TODO: Implement Twilio Verify or custom SMS provider
        // const client = twilio(Deno.env.get('TWILIO_ACCOUNT_SID'), Deno.env.get('TWILIO_AUTH_TOKEN'));
        // await client.verify.v2.services(Deno.env.get('TWILIO_VERIFY_SID_WHATSAPP'))
        //       .verifications.create({to: phone, channel: 'whatsapp'});

        return new Response(
            JSON.stringify({ success: true, message: "OTP sent via WhatsApp" }),
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
