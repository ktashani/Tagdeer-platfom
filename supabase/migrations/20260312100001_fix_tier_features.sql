-- Migration: Fix Tier Features
-- Description: Update tier_pricing features in platform_config to match actual platform capabilities
-- Corrects generic placeholder features with real tier-gated functionality

UPDATE public.platform_config
SET value = '[
    {
        "id": "free",
        "name": "Free",
        "price": 0,
        "duration": "monthly",
        "features": [
            "1 Business Location",
            "Accept Reviews",
            "Digital Storefront",
            "Basic Performance Dashboard",
            "5 Gader Points per Customer Scan"
        ],
        "isPopular": false,
        "isActive": true
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 99,
        "duration": "monthly",
        "features": [
            "Unlimited Locations",
            "Team Management (Cashiers & Managers)",
            "1 Active Coupon Campaign per Location",
            "15 Gader Points per Customer Scan",
            "Priority Support"
        ],
        "isPopular": true,
        "isActive": true
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 299,
        "duration": "monthly",
        "features": [
            "Everything in Pro",
            "Unlimited Active Campaigns",
            "30 Gader Points + Auto-Coupon per Scan",
            "Dedicated Account Manager",
            "Early Access to New Features"
        ],
        "isPopular": false,
        "isActive": true
    }
]'::jsonb,
updated_at = now()
WHERE key = 'tier_pricing';
