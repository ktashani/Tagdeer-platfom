-- Migration: Add Campaign Type for Addon Trials
ALTER TABLE public.trial_campaigns 
ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'tier_upgrade' CHECK (campaign_type IN ('tier_upgrade', 'addon_grant'));
