-- Migration: Financial Audit — Admin Subscription Actions & ERP Sync Queue
-- Sprint 5: feat/financial-audit

-- ============================================================
-- PART 1: Admin Subscription Management RPCs
-- ============================================================

-- RPC: Suspend a subscription (admin action during fraud investigation)
CREATE OR REPLACE FUNCTION admin_suspend_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- Get current status
    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status NOT IN ('Active', 'Expiring Soon') THEN
        RAISE EXCEPTION 'Can only suspend Active or Expiring Soon subscriptions. Current: %', v_old_status;
    END IF;

    -- Update status
    UPDATE public.subscriptions
    SET status = 'Suspended'
    WHERE id = p_subscription_id;

    -- Audit log
    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'suspended', v_old_status, 'Suspended', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Reinstate a suspended subscription
CREATE OR REPLACE FUNCTION admin_reinstate_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status != 'Suspended' THEN
        RAISE EXCEPTION 'Can only reinstate Suspended subscriptions. Current: %', v_old_status;
    END IF;

    UPDATE public.subscriptions
    SET status = 'Active'
    WHERE id = p_subscription_id;

    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'activated', 'Suspended', 'Active', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Terminate a subscription (permanent, non-reversible)
CREATE OR REPLACE FUNCTION admin_terminate_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status = 'Terminated' THEN
        RAISE EXCEPTION 'Subscription is already terminated';
    END IF;

    UPDATE public.subscriptions
    SET status = 'Terminated'
    WHERE id = p_subscription_id;

    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'terminated', v_old_status, 'Terminated', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 2: ERP Sync Queue (Passive Event Capture)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
    sync_attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Index for dequeuing
CREATE INDEX IF NOT EXISTS idx_erp_sync_queue_status ON public.erp_sync_queue(status) WHERE status = 'pending';

-- Enable RLS (admin-only read, trigger-only write)
ALTER TABLE public.erp_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync queue"
    ON public.erp_sync_queue FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Trigger: Capture transaction status changes
CREATE OR REPLACE FUNCTION erp_capture_transaction_event()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.erp_sync_queue (event_type, payload)
        VALUES (
            CASE
                WHEN NEW.status = 'completed' THEN 'payment_confirmed'
                WHEN NEW.status = 'rejected' THEN 'payment_rejected'
                ELSE 'transaction_updated'
            END,
            jsonb_build_object(
                'transaction_id', NEW.id,
                'business_id', NEW.business_id,
                'owner_id', NEW.owner_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'amount', NEW.amount,
                'currency', NEW.currency,
                'payment_gateway', NEW.payment_gateway,
                'requested_tier', NEW.requested_tier,
                'changed_at', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_erp_transaction ON public.transactions;
CREATE TRIGGER trg_erp_transaction
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION erp_capture_transaction_event();

-- Trigger: Capture subscription status changes
CREATE OR REPLACE FUNCTION erp_capture_subscription_event()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.erp_sync_queue (event_type, payload)
        VALUES (
            CASE
                WHEN NEW.status = 'Active' THEN 'subscription_activated'
                WHEN NEW.status = 'Expired' THEN 'subscription_expired'
                WHEN NEW.status = 'Suspended' THEN 'subscription_suspended'
                WHEN NEW.status = 'Terminated' THEN 'subscription_terminated'
                ELSE 'subscription_changed'
            END,
            jsonb_build_object(
                'subscription_id', NEW.id,
                'profile_id', NEW.profile_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'old_tier', OLD.tier,
                'new_tier', NEW.tier,
                'expires_at', NEW.expires_at,
                'changed_at', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_erp_subscription ON public.subscriptions;
CREATE TRIGGER trg_erp_subscription
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION erp_capture_subscription_event();
