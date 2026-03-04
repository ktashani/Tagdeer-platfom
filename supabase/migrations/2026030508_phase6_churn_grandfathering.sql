-- ==========================================
-- Phase 6: Merchant Churn Grandfathering
-- Pause active campaigns when subscription expires
-- ==========================================

CREATE OR REPLACE FUNCTION pause_campaigns_on_subscription_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the status changed to Expired
    IF NEW.status = 'Expired' AND OLD.status != 'Expired' THEN
        -- Pause all active campaigns for this business
        UPDATE public.merchant_coupons
        SET status = 'paused'
        WHERE business_id = NEW.business_id
          AND status = 'active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pause_campaigns_on_sub_expiry ON public.subscriptions;
CREATE TRIGGER trg_pause_campaigns_on_sub_expiry
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION pause_campaigns_on_subscription_expiry();
