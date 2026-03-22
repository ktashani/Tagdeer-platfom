-- ==========================================
-- Phase 5: Admin & Merchant Coupon Extensions
-- ==========================================

-- 5a. Admin Voucher Code Import Table
CREATE TABLE IF NOT EXISTS public.voucher_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'libyana', 'almadar', 'custom'
  denomination NUMERIC,
  status TEXT DEFAULT 'available', -- 'available', 'assigned', 'redeemed', 'expired'
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  imported_by UUID REFERENCES public.profiles(id),
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for voucher_codes
ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voucher_codes"
  ON public.voucher_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their assigned vouchers"
  ON public.voucher_codes FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());


-- 5b. Merchant Bulk Coupon Upload Support
ALTER TABLE public.merchant_coupons 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tagdeer_generated',
  ADD COLUMN IF NOT EXISTS imported_codes JSONB DEFAULT '[]'::jsonb;

-- Optional: If we want to prevent the RPC from assigning these if they run out, 
-- we would update the RPC, but the plan only asked for the upload UI in 5b.
