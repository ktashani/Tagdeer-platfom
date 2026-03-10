import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        const supabase = createClient(supabaseUrl, supabaseKey);

        // ✅ BUG-05 FIX: Single batch RPC replaces N+1 loop
        const { data, error } = await supabase.rpc('expire_coupons_batch');

        if (error) {
            throw error;
        }

        console.log(`Coupon expiry batch result:`, data);

        return new Response(JSON.stringify({
            message: "Successfully processed expired coupons.",
            ...data
        }), { status: 200 });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
