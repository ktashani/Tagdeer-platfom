"use client";

import React, { useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Shield, Coins, QrCode, Award, Flame, User, Briefcase, 
    HelpCircle, ChevronRight, CheckCircle2, XCircle, AlertTriangle 
} from 'lucide-react';

const dict = {
  ar: {
    title: "دليل منصة تقدير | قواعد وجدارة المنصة",
    subtitle: "أعطهم تقديرك، واكسب قدرك • اكتشف القوانين، الحدود، وحوافز الجدارة",
    tabConsumer: "دليل الزبون",
    tabMerchant: "دليل التاجر",
    
    // Consumer Guide
    consumerGaderTitle: "محفظة قَدْر (Gader Wallet)",
    consumerGaderDesc: "الحد الأدنى لفتح المحفظة واستقبال قسائم الخصم التلقائية هو 200 قَدْر مع تفعيل الحساب بالهاتف. التقييم الصادق (تقدير) يمنحك +10 قَدْر.",
    
    consumerScanTitle: "مسح الكود (QR Scanning)",
    consumerScanDesc: "امسح رمز المحل لكسب نقاط قَدْر: اشتراك مجاني (+5)، اشتراك برو (+15)، اشتراك مؤسسة (+30 + كوبون فوري).",
    
    consumerAntiCheatTitle: "إرشادات الاستخدام العادل وأمان المنصة",
    consumerAntiCheatDesc: "لضمان تجربة عادلة وموثوقة لجميع الأعضاء، يرجى مراعاة حدود الاستخدام التالية:",
    cooldownSameBiz: "فترة انتظار المتجر الواحد (7 أيام): لا يمكنك مسح كود نفس المتجر أكثر من مرة كل 7 أيام.",
    cooldownFarming: "حماية التجوال (60 دقيقة): يجب الانتظار 60 دقيقة بين مسح أكواد متاجر مختلفة لمنع مسح الأكواد من المنزل.",
    dailyScanLimit: "الحد اليومي العام: حد أقصى 5 عمليات مسح ناجحة يومياً على مستوى المنصة.",
    selfScanPrevention: "منع المسح الذاتي: أصحاب المحلات والموظفين لا يمكنهم مسح أكواد محلاتهم الخاصة.",
    
    consumerRatingTitle: "قوانين التقييم (تقدير)",
    consumerRatingDesc: "لحماية مؤشر القدر الخاص بالشركات وضمان نزاهة التقييمات:",
    ratingCooldownSameBiz: "التقييم اليومي: يمكنك تقييم نفس المتجر مرة واحدة كل 24 ساعة كحد أقصى.",
    diminishingReturnsTitle: "تأثير العوائد المتناقصة:",
    diminishingReturnsDesc: "التقييم المتكرر لنفَس المحل خلال 30 يوماً يقلل من وزن تأثيره (المرة 1: وزن كامل 1.0x، المرة 2: وزن 0.5x، المرة 3+: وزن ضئيل 0.25x).",
    verifiedMultiplierTitle: "مستويات الجدارة (للأعضاء الموثقين):",
    verifiedMultiplierDesc: "البرونزي (1.0x)، الفضي (1.5x)، الذهبي (2.0x)، والـ VIP (2.5x). التقييمات غير الموثقة (Anonymous) وزنها ثابت 0.25 ولا تمنح قَدْر أو مكافآت.",
    anonRatingLimit: "الحد اليومي للزوار: الزوار غير المسجلين لهم حد أقصى 5 تقييمات كل 24 ساعة.",

    // Merchant Guide
    merchantIndexTitle: "مؤشر القدر (Gader Index)",
    merchantIndexDesc: "سمعة محلك مبنية على جودة خدماتك. التقييمات محميّة ضد حملات التشويه المنظمة، حيث يحمل رأي العضو الموثق (ذهبي أو VIP) وزناً أعلى من الزوار المجهولين.",
    
    merchantTiersTitle: "مقارنة الباقات والاشتراكات",
    featureName: "الميزة / القدرة",
    freeTierName: "الباقة المجانية",
    proTierName: "باقة برو",
    enterpriseTierName: "باقة المؤسسة",
    
    tierListings: "مواقع الفروع",
    tierListingsFree: "فرع واحد فقط",
    tierListingsPro: "فروع غير محدودة",
    tierListingsEnterprise: "فروع غير محدودة",
    
    tierCampaigns: "الحملات النشطة",
    tierCampaignsFree: "غير متاح (0)",
    tierCampaignsPro: "حملة واحدة نشطة",
    tierCampaignsEnterprise: "حملات غير محدودة",
    
    tierCoupons: "الكوبونات النشطة",
    tierCouponsFree: "لا يوجد",
    tierCouponsPro: "حتى 5 كوبونات نشطة",
    tierCouponsEnterprise: "كوبونات غير محدودة",
    
    tierPoints: "نقاط كسب الزبائن",
    tierPointsFree: "5 قَدْر لكل مسح",
    tierPointsPro: "15 قَدْر لكل مسح",
    tierPointsEnterprise: "30 قَدْر لكل مسح",
    
    tierMandatoryReward: "جائزة مسح إجبارية",
    tierMandatoryRewardFree: "غير متاح",
    tierMandatoryRewardPro: "غير متاح",
    tierMandatoryRewardEnterprise: "متاح (كوبون فوري تلقائي)",
    
    tierShield: "درع الحماية وصندوق الحلول",
    tierShieldFree: "غير متاح",
    tierShieldPro: "غير متاح",
    tierShieldEnterprise: "متاح بالكامل (تأخير النقد السلبي)",
    
    merchantShieldTitle: "درع الحماية وصندوق الحلول (Trust Shield)",
    merchantShieldDesc: "متاح حصرياً لمشتركي باقة المؤسسة. عند قيام زبون موثق بتقديم شكوى سلبية، يقوم درع الحماية بحجزها في صندوق الحلول الخاص بك بشكل سري. يمنحك النظام فرصة للتواصل الخاص مع الزبون وإرضائه بكوبون تعويضي لحل المشكلة ودياً قبل تأثير الشكوى على مؤشر القدر العام لمحلك."
  },
  en: {
    title: "Tagdeer Guide | Platform Rules & Equity",
    subtitle: "Give your Tagdeer, earn your Gader • Discover the rules, boundaries, and trust incentives",
    tabConsumer: "Consumer Guide",
    tabMerchant: "Merchant Guide",
    
    // Consumer Guide
    consumerGaderTitle: "Gader Wallet",
    consumerGaderDesc: "To unlock the automatic coupon reward pool, your wallet must hold at least 200 Gader and your phone must be OTP verified. Submit an honest evaluation (Tagdeer) to earn +10 Gader.",
    
    consumerScanTitle: "QR Code Scanning",
    consumerScanDesc: "Scan the in-store placard to earn Gader instantly: Free tier store (+5 Gader), Pro tier store (+15 Gader), Enterprise tier store (+30 Gader & instant coupon drop).",
    
    consumerAntiCheatTitle: "Fair Use & Platform Integrity",
    consumerAntiCheatDesc: "To ensure absolute fairness and a reliable experience for all members, please note the following usage guidelines:",
    cooldownSameBiz: "7-Day Same-Business Cooldown: You can scan the QR code of the same business at most once every 7 days.",
    cooldownFarming: "60-Minute Farming Cooldown: You must wait at least 60 minutes between scanning different businesses.",
    dailyScanLimit: "Global Daily Cap: Limit of 5 unique scans per 24 hours across the entire platform.",
    selfScanPrevention: "Self-Scan Restriction: Business owners and cashiers cannot scan their own business code.",
    
    consumerRatingTitle: "Evaluation (Tagdeer) Rules",
    consumerRatingDesc: "To protect the Gader Index and keep evaluations honest:",
    ratingCooldownSameBiz: "Daily Evaluation Limit: You can evaluate the same business at most once every 24 hours.",
    diminishingReturnsTitle: "Diminishing Returns:",
    diminishingReturnsDesc: "Repeated evaluations on the same store within 30 days have reduced impact: 1st Vote is 1.0x, 2nd is 0.5x, and 3rd+ is 0.25x weight.",
    verifiedMultiplierTitle: "Power Tiers (Verified Accounts):",
    verifiedMultiplierDesc: "Bronze (1.0x), Silver (1.5x), Gold (2.0x), and VIP (2.5x). Anonymous evaluations have a fixed weight of 0.25 and do not earn Gader or coupons.",
    anonRatingLimit: "Unverified Device Limit: Unregistered devices are capped at 5 anonymous votes per 24 hours.",

    // Merchant Guide
    merchantIndexTitle: "Gader Index",
    merchantIndexDesc: "Your reputation index is built on mathematically weighted community feedback. Verified Gold or VIP users carry more weight than anonymous profiles, protecting you from coordinated smear reviews.",
    
    merchantTiersTitle: "Subscription Tiers & Capabilities",
    featureName: "Feature / Capability",
    freeTierName: "Free Tier",
    proTierName: "Pro Tier",
    enterpriseTierName: "Enterprise Tier",
    
    tierListings: "Listings Locations",
    tierListingsFree: "1 branch only",
    tierListingsPro: "Unlimited branches",
    tierListingsEnterprise: "Unlimited branches",
    
    tierCampaigns: "Active Campaigns",
    tierCampaignsFree: "Disabled (0)",
    tierCampaignsPro: "1 active campaign",
    tierCampaignsEnterprise: "Unlimited campaigns",
    
    tierCoupons: "Coupons per Campaign",
    tierCouponsFree: "None",
    tierCouponsPro: "Up to 5 active coupons",
    tierCouponsEnterprise: "Unlimited",
    
    tierPoints: "Points per Customer Scan",
    tierPointsFree: "5 Gader",
    tierPointsPro: "15 Gader",
    tierPointsEnterprise: "30 Gader",
    
    tierMandatoryReward: "Mandatory Scan Reward",
    tierMandatoryRewardFree: "Disabled",
    tierMandatoryRewardPro: "Disabled",
    tierMandatoryRewardEnterprise: "Enabled (Instant coupon drop)",
    
    tierShield: "Trust Shield & Resolution Inbox",
    tierShieldFree: "Disabled",
    tierShieldPro: "Disabled",
    tierShieldEnterprise: "Fully Enabled (Intercept negative logs)",
    
    merchantShieldTitle: "Trust Shield & The Resolution Inbox",
    merchantShieldDesc: "Exclusively on the Enterprise subscription. If a verified user submits a negative complaint, the Trust Shield intercepts it and puts it into your private Resolution Inbox. This grants you a grace period to chat privately with the customer and resolve the issue with a special coupon before it affects your public Gader Index!"
  }
};

export function PlatformHelp({ defaultTab = 'consumer', role = 'both' }) {
    const { lang } = useTagdeer();
    const currentLang = lang === 'ar' ? 'ar' : 'en';
    const t = dict[currentLang];
    const isRTL = currentLang === 'ar';

    const initialTab = role !== 'both' ? role : defaultTab;
    const [activeTab, setActiveTab] = useState(initialTab);

    React.useEffect(() => {
        if (role !== 'both') {
            setActiveTab(role);
        }
    }, [role]);

    return (
        <Card className="w-full bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl mt-8 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-850 dark:to-slate-900 border-b border-slate-250 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <HelpCircle className="w-5 h-5" />
                        <h2 className="text-xl font-bold tracking-tight">{t.title}</h2>
                    </div>
                    <p className="text-slate-500 text-xs font-medium md:text-sm">{t.subtitle}</p>
                </div>
                
                {/* Tab switcher */}
                {role === 'both' && (
                    <div className="flex bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl self-start md:self-auto border border-slate-300/40">
                        <button
                            onClick={() => setActiveTab('consumer')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
                                activeTab === 'consumer'
                                    ? 'bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>{t.tabConsumer}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('merchant')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
                                activeTab === 'merchant'
                                    ? 'bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>{t.tabMerchant}</span>
                        </button>
                    </div>
                )}
            </div>

            <CardContent className="p-6 md:p-8 space-y-6">
                {activeTab === 'consumer' ? (
                    /* CONSUMER PORTION */
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Two core cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Coins className="w-4 h-4" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.consumerGaderTitle}</h4>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t.consumerGaderDesc}</p>
                            </div>

                            <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                        <QrCode className="w-4 h-4" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.consumerScanTitle}</h4>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t.consumerScanDesc}</p>
                            </div>
                        </div>

                        {/* Anti-cheat Box */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 p-5 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <Shield className="w-4.5 h-4.5" />
                                <h4 className="font-bold text-sm">{t.consumerAntiCheatTitle}</h4>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">{t.consumerAntiCheatDesc}</p>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 pl-4 pr-4">
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <span>{t.cooldownSameBiz}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <span>{t.cooldownFarming}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <span>{t.dailyScanLimit}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <span>{t.selfScanPrevention}</span>
                                </li>
                            </ul>
                        </div>

                        {/* Rating (Tagdeer) rules details */}
                        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Award className="w-4.5 h-4.5" />
                                <h4 className="font-bold text-sm">{t.consumerRatingTitle}</h4>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">{t.consumerRatingDesc}</p>
                            
                            <div className="grid grid-cols-1 gap-4 text-xs">
                                <div className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 pr-3 py-1 space-y-1">
                                    <span className="font-bold text-slate-850 dark:text-slate-200">{t.ratingCooldownSameBiz}</span>
                                </div>
                                <div className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 pr-3 py-1 space-y-1">
                                    <span className="font-bold text-slate-850 dark:text-slate-200">{t.diminishingReturnsTitle}</span>
                                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.diminishingReturnsDesc}</p>
                                </div>
                                <div className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 pr-3 py-1 space-y-1">
                                    <span className="font-bold text-slate-850 dark:text-slate-200">{t.verifiedMultiplierTitle}</span>
                                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.verifiedMultiplierDesc}</p>
                                </div>
                                <div className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 pr-3 py-1 space-y-1">
                                    <span className="font-bold text-slate-850 dark:text-slate-200">{t.anonRatingLimit}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* MERCHANT PORTION */
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Core Gader Index Description */}
                        <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Award className="w-4 h-4" />
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.merchantIndexTitle}</h4>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t.merchantIndexDesc}</p>
                        </div>

                        {/* Table of Subscription Tiers */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                                <Flame className="w-4 h-4 text-orange-500" />
                                <span>{t.merchantTiersTitle}</span>
                            </h4>
                            
                            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/40">
                                <table className="w-full text-xs text-left min-w-[550px] border-collapse" dir={isRTL ? 'rtl' : 'ltr'}>
                                    <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 text-right">{t.featureName}</th>
                                            <th className="px-4 py-3 text-center text-emerald-600 font-bold">{t.freeTierName}</th>
                                            <th className="px-4 py-3 text-center text-blue-600 font-bold">{t.proTierName}</th>
                                            <th className="px-4 py-3 text-center text-indigo-600 font-bold">{t.enterpriseTierName}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-350">
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierListings}</td>
                                            <td className="px-4 py-3 text-center">{t.tierListingsFree}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierListingsPro}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierListingsEnterprise}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierCampaigns}</td>
                                            <td className="px-4 py-3 text-center text-slate-400">{t.tierCampaignsFree}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierCampaignsPro}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierCampaignsEnterprise}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierCoupons}</td>
                                            <td className="px-4 py-3 text-center text-slate-400">{t.tierCouponsFree}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierCouponsPro}</td>
                                            <td className="px-4 py-3 text-center font-medium">{t.tierCouponsEnterprise}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierPoints}</td>
                                            <td className="px-4 py-3 text-center">{t.tierPointsFree}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-blue-600">{t.tierPointsPro}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-indigo-600">{t.tierPointsEnterprise}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierMandatoryReward}</td>
                                            <td className="px-4 py-3 text-center text-slate-400"><XCircle className="w-4 h-4 mx-auto text-slate-300" /></td>
                                            <td className="px-4 py-3 text-center text-slate-400"><XCircle className="w-4 h-4 mx-auto text-slate-300" /></td>
                                            <td className="px-4 py-3 text-center text-indigo-600"><CheckCircle2 className="w-4 h-4 mx-auto text-indigo-500" /></td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-250 text-right">{t.tierShield}</td>
                                            <td className="px-4 py-3 text-center text-slate-400"><XCircle className="w-4 h-4 mx-auto text-slate-300" /></td>
                                            <td className="px-4 py-3 text-center text-slate-400"><XCircle className="w-4 h-4 mx-auto text-slate-300" /></td>
                                            <td className="px-4 py-3 text-center text-indigo-600"><CheckCircle2 className="w-4 h-4 mx-auto text-indigo-500" /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Trust Shield Highlight */}
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-200/70 dark:border-indigo-900/40 p-5 rounded-2xl space-y-2.5">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                                <Shield className="w-4.5 h-4.5" />
                                <h4 className="font-bold text-sm">{t.merchantShieldTitle}</h4>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t.merchantShieldDesc}</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
