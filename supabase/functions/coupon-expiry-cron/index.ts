import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
    try {
        // 1. Create a Supabase client with the Auth context of the user
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        // We use the Service Role key to bypass RLS for administrative tasks
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 2. Fetch all ACTIVE coupons that have passed their valid_until date
        const { data: expiredCoupons, error: fetchError } = await supabase
            .from("user_coupons")
            .select("id, campaign_id, source")
            .eq("status", "ACTIVE")
            .lt("valid_until", new Date().toISOString());

        if (fetchError) {
            throw fetchError;
        }

        if (!expiredCoupons || expiredCoupons.length === 0) {
            return new Response(JSON.stringify({ message: "No expired coupons found." }), { status: 200 });
        }

        console.log(`Found ${expiredCoupons.length} expired coupons. Proceeding with recycling...`);

        // Grouping coupons by Campaign ID to batch updates if necessary
        // But for simplicity, let's process them iteratively
        let poolReturns = 0;
        let directReturns = 0;

        for (const coupon of expiredCoupons) {
            // 3. Update the user's coupon status to EXPIRED
            const { error: updateError } = await supabase
                .from("user_coupons")
                .update({ status: "EXPIRED" })
                .eq("id", coupon.id);

            if (updateError) {
                console.error(`Error updating coupon ${coupon.id}:`, updateError);
                continue; // Skip the inventory return if the status update fails
            }

            // 4. Return the inventory if it came from the POOL or Direct Interaction
            // Either way, claimed_count on the merchant_coupons decreases.
            const { error: inventoryError } = await supabase.rpc('decrement_campaign_claimed_count', {
                p_campaign_id: coupon.campaign_id
            });

            if (inventoryError) {
                console.error(`Error returning inventory for campaign ${coupon.campaign_id}:`, inventoryError);
            } else {
                if (coupon.source === "POOL") {
                    poolReturns++;
                } else {
                    directReturns++;
                    // TODO: In Phase 6, we will add notifications for directReturns (VIP_SCAN/RESOLUTION)
                }
            }
        }

        return new Response(JSON.stringify({
            message: "Successfully processed expired coupons.",
            recycled_to_pool: poolReturns,
            recycled_to_merchant: directReturns
        }), { status: 200 });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
