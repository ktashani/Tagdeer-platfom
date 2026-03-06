-- Migration: Init Merchant Role
-- Description: A SECURITY DEFINER function that allows the init-role API to safely
-- set a user's role to 'merchant' (or create a profile if the trigger hasn't fired yet).
-- This is needed because the 'role' column is a user_role ENUM and the Supabase JS client
-- cannot implicitly cast text to the enum via PostgREST.

CREATE OR REPLACE FUNCTION init_merchant_role(
    p_user_id UUID,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
BEGIN
    -- Check if profile exists
    SELECT id, role INTO v_profile FROM public.profiles WHERE id = p_user_id;

    IF v_profile.id IS NOT NULL THEN
        -- Profile exists: only update role if currently 'user' or 'consumer'
        IF v_profile.role = 'user'::public.user_role THEN
            UPDATE public.profiles SET role = 'merchant'::public.user_role WHERE id = p_user_id;
            RETURN jsonb_build_object('success', true, 'action', 'updated');
        ELSE
            -- Already merchant/admin — no change needed
            RETURN jsonb_build_object('success', true, 'action', 'no_change', 'current_role', v_profile.role::text);
        END IF;
    ELSE
        -- Profile doesn't exist yet (trigger delay) — insert it
        INSERT INTO public.profiles (id, email, phone, role, user_id)
        VALUES (
            p_user_id,
            COALESCE(p_email, 'unknown@merchant.local'),
            COALESCE(p_phone, '+000' || extract(epoch from now())::bigint::text),
            'merchant'::public.user_role,
            'AUTH-' || upper(substring(p_user_id::text from 1 for 5))
        )
        ON CONFLICT (id) DO UPDATE SET role = 'merchant'::public.user_role;

        RETURN jsonb_build_object('success', true, 'action', 'inserted');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
