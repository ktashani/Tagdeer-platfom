const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const newTiers = [
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
  ];

  const { error } = await supabase
    .from('platform_config')
    .update({ value: newTiers })
    .eq('key', 'tier_pricing');

  if (error) {
    console.error("Mutation failed:", error);
  } else {
    console.log("Tier allocations successfully injected into platform_config!");
  }
}
run();
