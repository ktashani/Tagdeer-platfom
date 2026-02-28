-- ==========================================
-- Admin Dispute Resolution RPC
-- ==========================================

CREATE OR REPLACE FUNCTION admin_resolve_dispute(p_dispute_id UUID, p_verdict TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    -- Ensure the caller is an admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can resolve disputes';
    END IF;

    -- Get the targeted log ID from the dispute
    SELECT log_id INTO v_log_id FROM public.disputes WHERE id = p_dispute_id;

    IF p_verdict = 'fake' THEN
        -- Approve the dispute (fake review) and permanently delete the log
        UPDATE public.disputes SET status = 'approved_fake', resolved_at = now() WHERE id = p_dispute_id;
        DELETE FROM public.interactions WHERE id = v_log_id;
        
        -- Penalizing user trust points would go here
    ELSIF p_verdict = 'valid' THEN
        -- Reject the dispute (valid review), keep the log
        UPDATE public.disputes SET status = 'rejected_valid', resolved_at = now() WHERE id = p_dispute_id;
    END IF;

END;
$$;
