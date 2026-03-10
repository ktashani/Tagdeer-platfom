const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    try {
        let email = 'kousai.tl@gmail.com';
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, has_password, email')
            .ilike('email', '%' + 'kousai.tl@gmail.com' + '%');

        console.log('Profiles match:', profile);
    } catch (err) {
        console.error(err);
    }
})();
