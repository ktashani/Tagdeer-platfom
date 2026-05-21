import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { InstagramBlock, FacebookBlock } from './SocialEmbeds';
import StorefrontLiveScore from './StorefrontLiveScore';
import { InlineReviewBlock } from './InlineReviewBlock';
import {
    Store, MapPin, Phone, Globe, ExternalLink, ShieldCheck,
    Sparkles, Star, MessageCircle, Instagram, Facebook, ChevronRight,
    AlertTriangle, Info
} from 'lucide-react';
import StorefrontGalleryUI from '@/components/consumer/StorefrontGalleryUI';
import StorefrontProductsUI from '@/components/consumer/StorefrontProductsUI';
// Supabase Server Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ISR: revalidate every 60 seconds
export const revalidate = 60;

// ─── Bilingual Labels ────────────────────────────────────────
const labels = {
    en: {
        recommend: 'Recommend',
        complain: 'Complain',
        gaderScore: 'Gader Index',
        gallery: 'Gallery',
        products: 'Products',
        communityReviews: 'Community Tagdeer',
        rateExperience: 'Rate Your Experience',
        rateDesc: 'Help {name} improve by leaving a verified public tagdeer through Tagdeer.',
        leaveReview: 'Share Your Tagdeer',
        callNow: 'Call Now',
        directions: 'Directions',
        whatsapp: 'WhatsApp',
        poweredBy: 'Powered by',
        recommended: 'Recommended',
        complained: 'Complained',
        like: 'Like',
        dislike: 'Dislike',
        menu: 'Menu',
        call: 'Call',
        socialConnect: 'Connect With Us',
        noLogsYet: 'No logs have been added for this business yet.',
    },
    ar: {
        recommend: 'أنصح به',
        complain: 'لا أنصح به',
        gaderScore: 'مؤشر القَدْر',
        gallery: 'المعرض',
        products: 'المنتجات',
        communityReviews: 'تجارب المجتمع',
        rateExperience: 'شاركنا تقديرك',
        rateDesc: 'ساعد {name} على التحسن بترك تقييم موثق عبر تقدير.',
        leaveReview: 'أضف تقديرك',
        callNow: 'اتصل الآن',
        directions: 'الاتجاهات',
        whatsapp: 'واتساب',
        poweredBy: 'مدعوم بواسطة',
        recommended: 'أنصح به',
        complained: 'لا أنصح به',
        like: 'أعجبني',
        dislike: 'لم يعجبني',
        menu: 'القائمة',
        call: 'اتصل',
        socialConnect: 'تواصل معنا',
        noLogsYet: 'لم تتم إضافة أي نشاطات لهذا النشاط بعد.',
    },
};

// ─── SEO Metadata ────────────────────────────────────────────
export async function generateMetadata({ params, searchParams }) {
    const slug = (await params).slug;

    const { data: storefront } = await supabase
        .from('storefronts')
        .select(`seo_metadata, businesses ( name, category, region )`)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

    if (!storefront) return { title: 'Storefront Not Found | Tagdeer' };

    const seo = storefront.seo_metadata || {};
    const biz = storefront.businesses;

    const meta = {
        title: seo.title || `${biz?.name} | Tagdeer`,
        description: seo.description || `Discover ${biz?.name} in ${biz?.region} on Tagdeer.`,
        openGraph: {
            title: seo.title || biz?.name,
            description: seo.description || `Discover ${biz?.name} on Tagdeer`,
            images: seo.og_image ? [{ url: seo.og_image }] : [],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: seo.title || biz?.name,
            description: seo.description,
        },
    };

    if (seo.search_console_id) {
        meta.verification = { google: seo.search_console_id };
    }

    return meta;
}

// ─── Helper Functions ──────────────────────────────────────────
const ensureAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};

// ─── Page Component ──────────────────────────────────────────
export default async function PublicStorefront({ params, searchParams }) {
    const slug = (await params).slug;
    // Default to 'ar' unless explicitly requested as 'en'
    const lang = (await searchParams)?.lang === 'en' ? 'en' : 'ar';
    const t = labels[lang];
    const isRTL = lang === 'ar';

    // Fetch everything via single joined query (Phase 6e)
    const { data: storefront, error } = await supabase
        .from('storefronts')
        .select(`
            *,
            businesses (
                id, name, category, region, external_url, recommends, complains, display_score, claimed_by,
                feature_allocations ( feature_type, status ),
                logs ( id, interaction_type, reason_text, created_at, profile_id, fingerprint, helpful_votes, unhelpful_votes, weight )
            ),
            catalog_items ( id, name, description, price, image_url, category, sku, is_active, likes, dislikes, display_order )
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .order('created_at', { foreignTable: 'businesses.logs', ascending: false })
        .limit(10, { foreignTable: 'businesses.logs' })
        .single();

    if (error || !storefront) {
        console.error("PublicStorefront Error:", error);
        notFound();
    }

    const business = storefront.businesses;
    const theme = storefront.theme_config || { primaryColor: '#10b981', secondaryColor: '#0f172a' };
    const contacts = storefront.contact_overrides || {};
    const seo = storefront.seo_metadata || {};

    // Defensive: sort/limit logs client-side as fallback if PostgREST nested ordering fails
    const recentLogs = (business.logs || [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

    // Trust Shield check
    const hasTrustShield = business.feature_allocations?.some(f => f.feature_type === 'shield' && f.status === 'active');

    // Products (active only, sorted)
    const products = (storefront.catalog_items || [])
        .filter(item => item.is_active)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    const groupedProducts = products.reduce((acc, item) => {
        const cat = item.category || (isRTL ? 'عام' : 'General');
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // Maps direction URL
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.name + ', ' + business.region + ', Libya')}`;

    // Trust score — Phase 2c: Use display_score as unified source
    const totalVotes = (business.recommends || 0) + (business.complains || 0);
    const gaderScore = business.display_score != null
        ? Math.round(business.display_score)
        : totalVotes > 0
            ? Math.round(((business.recommends || 0) / totalVotes) * 100)
            : null;
    const trustScore = gaderScore != null ? `${gaderScore}%` : 'N/A';

    // JSON-LD Structured Data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: business.name,
        description: storefront.description,
        image: storefront.logo_url || storefront.banner_url,
        url: `https://tagdeer.app/b/${slug}`,
        address: { '@type': 'PostalAddress', addressRegion: business.region, addressCountry: 'LY' },
        ...(contacts.phone && { telephone: contacts.phone }),
        ...(contacts.website && { sameAs: [contacts.website] }),
    };

    return (
        <main className="min-h-screen bg-[#f0f2f5] dark:bg-black/95 pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* JSON-LD */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            {/* ─── Tracking Pixels ───────────────────────────── */}
            {seo.meta_pixel_id && (
                <Script id="fb-pixel" strategy="afterInteractive">{`
                    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
                    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init','${seo.meta_pixel_id}');fbq('track','PageView');
                `}</Script>
            )}
            {seo.google_ads_id && (
                <>
                    <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.google_ads_id}`} strategy="afterInteractive" />
                    <Script id="gtag-ads">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.google_ads_id}');`}</Script>
                </>
            )}
            {seo.gtm_id && !seo.google_ads_id && (
                <>
                    <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.gtm_id}`} strategy="afterInteractive" />
                    <Script id="gtag-gtm">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.gtm_id}');`}</Script>
                </>
            )}

            {/* ─── Banner ────────────────────────────────────── */}
            <div
                className="w-full h-56 md:h-72 bg-slate-200 dark:bg-slate-800 relative"
                style={{
                    backgroundImage: storefront.banner_url ? `url(${storefront.banner_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="max-w-3xl mx-auto h-full relative px-4 md:px-8">
                    <div className="absolute -bottom-12 left-4 md:left-8 w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-[#f0f2f5] dark:border-black/95 bg-white dark:bg-slate-800 overflow-hidden shadow-md flex items-center justify-center z-10">
                        {storefront.logo_url ? (
                            <img src={storefront.logo_url} className="w-full h-full object-cover" alt={`${business.name} Logo`} />
                        ) : (
                            <Store className="w-12 h-12 text-slate-300" />
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 md:px-8 pt-16">

                {/* ─── Header ─────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            {business.name}
                            {hasTrustShield && (
                                <span title="Tagdeer Trust Shield Verified" className="inline-flex pt-1">
                                    <ShieldCheck className="w-6 h-6 text-amber-500" />
                                </span>
                            )}
                        </h1>
                        <p className="font-bold text-lg mt-1" style={{ color: theme.primaryColor }}>
                            {business.category} • {business.region}
                        </p>
                    </div>
                </div>

                {/* ─── Social CTA Bar ─────────────────────────── */}
                <div className="flex gap-2 items-center flex-wrap mt-5">
                    {contacts.phone && (
                        <a href={`tel:${contacts.phone}`} className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 transition-all" title={t.callNow}>
                            <Phone className="w-5 h-5" />
                        </a>
                    )}
                    {seo.whatsapp && (
                        <a href={`https://wa.me/${seo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-green-600 hover:border-green-300 transition-all" title={t.whatsapp}>
                            <MessageCircle className="w-5 h-5" />
                        </a>
                    )}
                    {contacts.instagram && (
                        <a href={ensureAbsoluteUrl(contacts.instagram)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 hover:border-pink-300 transition-all" title="Instagram">
                            <Instagram className="w-5 h-5" />
                        </a>
                    )}
                    {contacts.facebook && (
                        <a href={ensureAbsoluteUrl(contacts.facebook)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 transition-all" title="Facebook">
                            <Facebook className="w-5 h-5" />
                        </a>
                    )}
                    {(contacts.website || business.external_url) && (
                        <a href={ensureAbsoluteUrl(contacts.website || business.external_url)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition-all" title="Website">
                            <Globe className="w-5 h-5" />
                        </a>
                    )}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-300 transition-all" title={t.directions}>
                        <MapPin className="w-5 h-5" />
                    </a>
                </div>

                {/* ─── Description ─────────────────────────────── */}
                {storefront.description && (
                    <div className="mt-8">
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {storefront.description}
                        </p>
                    </div>
                )}

                {/* ═══ LEGAL DISCLAIMER ═══ */}
                <div className="mt-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            {isRTL
                                ? 'التقييمات والمراجعات المعروضة هنا مقدمة من أعضاء مجتمع تقدير وتمثل آراءهم الشخصية. لا تتحقق تقدير من هذا المحتوى أو تؤيده أو تتحمل مسؤوليته.'
                                : 'The evaluations and ratings shown here are submitted by Tagdeer community members and represent their personal opinions. Tagdeer does not verify, endorse, or take responsibility for this content.'}
                        </span>
                    </p>
                </div>

                {/* Community listing notice for unclaimed businesses */}
                {!business.claimed_by && (
                    <div className="mt-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                    {isRTL
                                        ? 'هذه القائمة أنشأها أحد أعضاء مجتمع تقدير. هل أنت صاحب هذا النشاط التجاري؟'
                                        : 'This listing was created by a Tagdeer community member. Are you the owner of this business?'}
                                </p>
                                <a href="/merchant/login" className="text-xs text-amber-800 dark:text-amber-300 font-bold hover:underline mt-1 inline-block">
                                    {isRTL ? 'طالب بنشاطك التجاري ←' : 'Claim your business →'}
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Action CTAs ────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                    {contacts.phone && (
                        <a href={`tel:${contacts.phone}`}
                            className="py-4 rounded-xl text-center text-white font-bold text-lg shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            style={{ backgroundColor: theme.primaryColor }}>
                            <Phone className="w-5 h-5" /> {t.callNow}
                        </a>
                    )}
                    {seo.whatsapp && (
                        <a href={`https://wa.me/${seo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="py-4 rounded-xl text-center bg-green-500 text-white font-bold text-lg shadow-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                            <MessageCircle className="w-5 h-5" /> {t.whatsapp}
                        </a>
                    )}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                        className="py-4 rounded-xl text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-bold text-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                        <MapPin className="w-5 h-5" /> {t.directions}
                    </a>
                </div>

                {/* ─── Community Trust & Rating — Phase 3: LIVE via Realtime ── */}
                <StorefrontLiveScore
                    initialBusiness={business}
                    initialLogs={recentLogs || []}
                    isRTL={isRTL}
                    theme={theme}
                    labels={{ ...t, rateDesc: t.rateDesc.replace('{name}', business.name) }}
                />

                {/* ─── Inline Review Block (remains separate for vote form) ── */}
                <div className="mt-4 [&>div]:shadow-none [&>div]:border-0 [&>div]:p-0 [&>div]:rounded-none">
                    <InlineReviewBlock businessId={business.id} business={business} isRTL={isRTL} theme={theme} />
                </div>

                {/* ─── Products & Services ────────────────────── */}
                <StorefrontProductsUI 
                    title={t.products} 
                    allProducts={products} 
                    groupedProducts={groupedProducts} 
                    theme={theme} 
                    isRTL={isRTL} 
                />

                {/* ─── Gallery ─────────────────────────────────── */}
                <StorefrontGalleryUI 
                    title={t.gallery} 
                    images={storefront.gallery_urls || storefront.gallery_images || []} 
                    theme={theme} 
                    isRTL={isRTL} 
                />

                {/* ─── Social Connect Section ─────────────────── */}
                {contacts.instagram && (
                    <div className="mt-12">
                        <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                            <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                            {t.socialConnect}
                        </h3>
                        <div className="max-w-md mx-auto">
                            <InstagramBlock url={ensureAbsoluteUrl(contacts.instagram)} isRTL={isRTL} />
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Tagdeer Branding ───────────────────────────── */}
            <div className="mt-20 pb-8 text-center">
                <a href="/" className="inline-flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">{t.poweredBy}</span>
                    <span className="font-black text-xl tracking-tighter text-slate-900 dark:text-white">TAGDEER</span>
                </a>
            </div>

            {/* ─── Mobile Sticky Footer ──────────────────────── */}
            <div className="fixed bottom-0 inset-x-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 md:hidden z-50">
                <div className="flex gap-3 max-w-sm mx-auto">
                    {contacts.phone && (
                        <a href={`tel:${contacts.phone}`}
                            className="flex-1 py-3.5 rounded-xl text-center text-white font-bold shadow-md hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ backgroundColor: theme.primaryColor }}>
                            <Phone className="w-5 h-5" /> {t.call}
                        </a>
                    )}
                    {seo.whatsapp && (
                        <a href={`https://wa.me/${seo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="flex-1 py-3.5 rounded-xl text-center bg-green-500 text-white font-bold shadow-md hover:bg-green-600 flex items-center justify-center gap-2">
                            <MessageCircle className="w-5 h-5" />
                        </a>
                    )}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-3.5 rounded-xl text-center bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-bold shadow-sm flex items-center justify-center gap-2">
                        <MapPin className="w-5 h-5" /> {isRTL ? '' : 'Map'}
                    </a>
                </div>
            </div>
        </main>
    );
}
