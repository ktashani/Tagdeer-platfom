import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role to bypass RLS for a moment to isolate RLS vs actual DB lock
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '0ab8bb67-a80d-4d7f-afb6-ff13fe2eb66f'; // The one from user's URL

const testUpsert = async () => {
    console.log("Starting test upsert with ADMIN...");
    const payload = {
        business_id: businessId,
        slug: 'test-new-2-hang-test',
        theme_config: { primaryColor: '#10b981', secondaryColor: '#0f172a' },
        seo_metadata: { title: '', description: '' },
        contact_overrides: { phone: '', email: '', facebook: '', instagram: '', website: '' },
        description: '',
        logo_url: '',
        banner_url: '',
        gallery_images: [],
        status: 'draft',
        updated_at: new Date().toISOString()
    };

    const start = Date.now();
    try {
        const { data, error } = await supabaseAdmin
            .from('storefronts')
            .upsert(payload, { onConflict: 'business_id', ignoreDuplicates: false })
            .select();

        if (error) {
            console.error("Error:", error);
        } else {
            console.log("Success:", data);
        }
    } catch (e) {
        console.error("Caught exception:", e);
    }
    console.log("Finished in", Date.now() - start, "ms");
};

testUpsert();
