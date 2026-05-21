import { createClient } from '@supabase/supabase-js';

export const metadata = {
    title: 'Discover Businesses — Tagdeer تقدير',
    description: 'Find and evaluate trusted businesses in Tripoli, Benghazi, and across Libya. Read real community evaluations and share your experience on Tagdeer.',
    openGraph: {
        title: 'Discover Businesses — Tagdeer',
        description: 'Find and evaluate trusted businesses across Libya.',
        type: 'website',
    },
};

// ISR: Revalidate every 5 minutes for SEO crawlers
export const revalidate = 300;

async function getBusinessesForSEO() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return [];

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
        .from('businesses')
        .select('id, name, region, category, recommends, complains, storefronts(slug)')
        .eq('status', 'published')
        .order('recommends', { ascending: false })
        .limit(50);

    return data || [];
}

export default async function DiscoverLayout({ children }) {
    const businesses = await getBusinessesForSEO();

    return (
        <>
            {children}
            {/* SEO fallback for crawlers that don't execute JavaScript */}
            <noscript>
                <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                    <h1>Discover Businesses on Tagdeer</h1>
                    <p>Community-verified business evaluations in Libya</p>
                    <ul>
                        {businesses.map(b => {
                            const slug = Array.isArray(b.storefronts) && b.storefronts[0]?.slug;
                            return (
                                <li key={b.id}>
                                    {slug ? (
                                        <a href={`/b/${slug}`}>{b.name}</a>
                                    ) : (
                                        <span>{b.name}</span>
                                    )}
                                    {' — '}{b.category}, {b.region}
                                    {' ('}{b.recommends || 0}{' recommends, '}{b.complains || 0}{' complains)'}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </noscript>
        </>
    );
}
