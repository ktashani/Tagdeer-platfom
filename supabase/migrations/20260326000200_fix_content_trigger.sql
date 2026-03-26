-- ============================================================
-- Hotfix: Fix check_log_content trigger column name
-- The trigger was referencing NEW.text but the column is reason_text
-- This was blocking ALL log inserts (including submit_vote RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_log_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_match RECORD;
    v_text TEXT;
BEGIN
    v_text := LOWER(COALESCE(NEW.reason_text, ''));

    -- Skip empty text
    IF v_text = '' THEN
        RETURN NEW;
    END IF;

    -- Check against the dictionary
    SELECT w.word, w.severity INTO v_match
    FROM public.content_filter_words w
    WHERE v_text LIKE '%' || LOWER(w.word) || '%'
    ORDER BY w.severity DESC   -- block > flag > shadow
    LIMIT 1;

    IF v_match IS NOT NULL THEN
        IF v_match.severity = 'block' THEN
            RAISE EXCEPTION 'المحتوى يحتوي على كلمات محظورة — يرجى تعديل النص'
                USING ERRCODE = 'P0010';
        ELSIF v_match.severity = 'shadow' THEN
            -- Allow but exclude from index calculations
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'shadow_filter: ' || v_match.word;
        ELSE
            -- flag: allow but mark for admin review
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'content_filter: ' || v_match.word;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Force PostgREST to reload
NOTIFY pgrst, 'reload schema';
