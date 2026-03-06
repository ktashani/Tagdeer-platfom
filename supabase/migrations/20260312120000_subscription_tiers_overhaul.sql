-- Migration: Update Subscription Tiers
-- Description: Replace Tier 1/2 with Free, Pro, Enterprise model

INSERT INTO public.platform_config (key, value) VALUES
('tier_pricing', '[
    {
        "id": "free", 
        "name": "Free", 
        "price": 0, 
        "duration": "monthly", 
        "features": ["1 Business Location", "Accept Reviews", "Basic Dashboard"],
        "isPopular": false,
        "isActive": true
    },
    {
        "id": "pro", 
        "name": "Pro", 
        "price": 99, 
        "duration": "monthly", 
        "features": ["Unlimited Locations", "Team Management", "Priority Support", "Early Access"],
        "isPopular": true,
        "isActive": true
    },
    {
        "id": "enterprise", 
        "name": "Enterprise", 
        "price": 299, 
        "duration": "monthly", 
        "features": ["White-label Reports", "API Access", "Custom Integrations", "Dedicated Account Manager"],
        "isPopular": false,
        "isActive": true
    }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
