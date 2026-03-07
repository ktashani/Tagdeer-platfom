-- Migration: Storefront Enhancements
-- Description: Adds gallery_images column to the storefronts table to support image galleries

ALTER TABLE public.storefronts
ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;
