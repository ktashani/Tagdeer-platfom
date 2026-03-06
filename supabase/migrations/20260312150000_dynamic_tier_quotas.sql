-- Migration: Add Dynamic Tier Quotas
-- Description: Updates the tier_pricing JSON in platform_config to securely inject system allocation parameters for the new Merchant-Centric architecture.

UPDATE public.platform_config 
SET value = '[
    {
        "id": "free", 
        "name": "Free", 
        "price": 0, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": 1,
            "max_shields": 0,
            "max_campaigns": 0,
            "gader_points": 5
        },
        "features": ["1 Business Location", "Accept Reviews", "Basic Dashboard"],
        "isActive": true,
        "isPopular": false
    },
    {
        "id": "pro", 
        "name": "Pro", 
        "price": 99, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": -1,
            "max_shields": 0,
            "max_campaigns": 1,
            "gader_points": 15
        },
        "features": ["Unlimited Locations", "Team Management", "Priority Support", "Early Access"],
        "isActive": true,
        "isPopular": true
    },
    {
        "id": "enterprise", 
        "name": "Enterprise", 
        "price": 299, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": -1,
            "max_shields": -1,
            "max_campaigns": -1,
            "gader_points": 30
        },
        "features": ["White-label Reports", "API Access", "Custom Integrations", "Dedicated Account Manager"],
        "isActive": true,
        "isPopular": false
    }
]'::jsonb
WHERE key = 'tier_pricing';
