import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { InstagramBlock, FacebookBlock } from './SocialEmbeds';
import { InlineReviewBlock } from './InlineReviewBlock';
import {
    Store, MapPin, Phone, Globe, ExternalLink, ShieldCheck,
    Sparkles, Star, MessageCircle, Instagram, Facebook, ChevronRight
} from 'lucide-react';
import ProductCard from '@/components/consumer/ProductCard';

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
        gaderScore: 'Gader Score',
        gallery: 'Gallery',
        products: 'Products',
        communityReviews: 'Community Reviews',
        rateExperience: 'Rate Your Experience',
        rateDesc: (name) => `Help ${name} improve by leaving a verified public review through Tagdeer.`,
        leaveReview: 'Leave a Review',
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
        rateDesc: (name) => `ساعد ${name} على التحسن بترك تقييم موثق عبر تقدير.`,
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

    // Fetch everything
    const { data: storefront, error } = await supabase
        .from('storefronts')
        .select(`
            *,
            businesses (
                id, name, category, region, external_url, recommends, complains,
                feature_allocations ( feature_type, status )
            ),
            catalog_items ( id, name, description, price, image_url, category, sku, is_active, likes, dislikes, display_order )
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

    if (error || !storefront) {
        console.error("PublicStorefront Error:", error);
        notFound();
    }

    const business = storefront.businesses;
    const theme = storefront.theme_config || { primaryColor: '#10b981', secondaryColor: '#0f172a' };
    const contacts = storefront.contact_overrides || {};
    const seo = storefront.seo_metadata || {};

    // Recent reviews from correct table
    const { data: recentLogs } = await supabase
        .from('logs')
        .select('id, interaction_type, reason_text, created_at, profile_id')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(5);

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

    // Trust score
    const totalVotes = (business.recommends || 0) + (business.complains || 0);
    const trustScore = totalVotes > 0
        ? Math.round(((business.recommends || 0) / totalVotes) * 100) + '%'
        : 'N/A';

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

                {/* ─── Community Trust & Rating ─────────────────── */}
                <div className="mt-8 p-2 rounded-[2rem] bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 shadow-sm text-center flex flex-col justify-center items-center">
                            <div className="text-2xl md:text-3xl font-black text-emerald-500 mb-0.5">{business.recommends || 0}</div>
                            <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] md:text-xs">{t.recommend}</div>
                        </div>
                        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 shadow-sm text-center flex flex-col justify-center items-center" style={{ backgroundColor: theme.primaryColor + '10' }}>
                            <div className="text-3xl md:text-4xl font-black mb-0.5" style={{ color: theme.primaryColor }}>{trustScore}</div>
                            <div className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] md:text-xs">{t.gaderScore}</div>
                        </div>
                        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 shadow-sm text-center flex flex-col justify-center items-center">
                            <div className="text-2xl md:text-3xl font-black text-rose-500 mb-0.5">{business.complains || 0}</div>
                            <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] md:text-xs">{t.complain}</div>
                        </div>
                    </div>
                    {/* We wrap InlineReviewBlock to override its default outer margin and border securely */}
                    <div className="[&>div]:mt-0 [&>div]:shadow-sm">
                        <InlineReviewBlock businessId={business.id} isRTL={isRTL} theme={theme} />
                    </div>
                </div>

                {/* ─── Products / Menu ─────────────────────────── */}
                {Object.keys(groupedProducts).length > 0 && (
                    <div className="mt-12 space-y-10">
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                            {t.products}
                        </h3>
                        {Object.entries(groupedProducts).map(([category, items]) => (
                            <div key={category}>
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{category}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map(item => (
                                        <ProductCard key={item.id} item={item} theme={theme} lang={lang} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── Gallery ─────────────────────────────────── */}
                {storefront.gallery_images && storefront.gallery_images.length > 0 && (
                    <div className="mt-12">
                        <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                            <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                            {t.gallery}
                        </h3>
                        <div className="flex overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
                            {storefront.gallery_images.map((imgUrl, i) => (
                                <div key={i} className="snap-center shrink-0 w-72 h-48 md:w-96 md:h-64 rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                                    <img src={imgUrl} alt={`${t.gallery} ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Community Logs History ──────────────────── */}
                <div className="mt-12">
                    <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                        {t.communityReviews}
                    </h3>
                    {recentLogs && recentLogs.length > 0 ? (
                        <div className="space-y-4">
                            {recentLogs.map(log => (
                                <div key={log.id} className="p-4 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
                                    <div className={`flex items-start gap-4 mb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 shrink-0 mt-1">
                                            💬
                                        </div>
                                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                                            <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                                                <p className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
                                                    {isRTL ? 'مستخدم لتقدير' : 'Tagdeer User'}
                                                </p>
                                                {log.interaction_type === 'recommend' ? (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider leading-none self-start sm:self-auto">{t.recommend}</span>
                                                ) : (
                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider leading-none self-start sm:self-auto">{t.complain}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1.5 font-medium">
                                                {new Date(log.created_at).toLocaleDateString(isRTL ? 'ar-LY' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    {log.reason_text && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <p className={`text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap ${isRTL ? 'text-right' : ''}`}>
                                                "{log.reason_text}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 md:p-12 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 border-dashed dark:border-slate-800 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mb-4 opacity-50">💬</div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-sm">
                                {t.noLogsYet}
                            </p>
                        </div>
                    )}
                </div>



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
