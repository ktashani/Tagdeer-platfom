-- ============================================================
-- Coupon Serial Code Uniqueness Constraint
-- Prevents duplicate serial codes in the merchant_coupons table.
-- Combined with crypto-secure generation, makes collisions
-- virtually impossible, and catches them at the DB level if they occur.
-- ============================================================

-- Add unique constraint (IF NOT EXISTS is not supported for constraints,
-- so we use a DO block to check first)
DO $$
BEGIN
    -- Only add constraint if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'merchant_coupons'
        AND column_name = 'serial_code'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_serial_code'
    ) THEN
        ALTER TABLE merchant_coupons
        ADD CONSTRAINT unique_serial_code UNIQUE (serial_code);
    END IF;
END;
$$;
