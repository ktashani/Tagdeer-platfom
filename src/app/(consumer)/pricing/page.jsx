"use client";

import React, { useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import Link from 'next/link';
import {
    Check,
    Crown,
    ShieldAlert,
    ShieldCheck,
    ArrowRight,
    TrendingUp,
    Users,
    MessageSquare,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PricingPage() {
    const { t, lang, isRTL, shieldPricing = { trust: 20, fatora: 50 }, tierPricing = [] } = useTagdeer();
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const priceTier1 = tierPricing[0]?.price ?? 49;
    const priceTier2 = tierPricing[1]?.price ?? 99;

    const toggleFaq = (index) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    const benefits = [
        {
            icon: <TrendingUp className="w-6 h-6 text-blue-600" />,
            title: lang === 'ar' ? 'نمو مبني على البيانات' : 'Data-Driven Growth',
            desc: lang === 'ar' ? 'احصل على تحليلات دقيقة لزوار ملفك التجاري وتفاعلهم لزيادة مبيعاتك.' : 'Get accurate analytics on your profile visitors and interactions to boost sales.'
        },
        {
            icon: <MessageSquare className="w-6 h-6 text-emerald-600" />,
            title: lang === 'ar' ? 'إدارة السمعة' : 'Reputation Management',
            desc: lang === 'ar' ? 'تفاعل مع آراء عملائك، حل الشكاوى بسرعة، واشكرهم على تقييماتهم الإيجابية.' : 'Engage with customer reviews, resolve complaints quickly, and thank them for positive feedback.'
        },
        {
            icon: <Users className="w-6 h-6 text-purple-600" />,
            title: lang === 'ar' ? 'ولاء العملاء المقدرين' : 'VIP Loyalty',
            desc: lang === 'ar' ? 'قدم عروض خاصة وحصرية لعملاء تقدير المميزين لجذبهم كعملاء دائمين.' : 'Offer exclusive, special deals to premium Tagdeer customers to win their loyalty.'
        }
    ];

    const faqs = [
        {
            q: lang === 'ar' ? 'هل يمكنني الترقية أو الإلغاء في أي وقت؟' : 'Can I upgrade or cancel at any time?',
            a: lang === 'ar' ? 'نعم، اشتراكاتنا شهرية بدون التزامات طويلة الأمد. يمكنك ترقية باقتك أو إلغائها من لوحة التحكم في أي وقت.' : 'Yes, our subscriptions are monthly with no long-term commitments. You can upgrade or cancel from your dashboard anytime.'
        },
        {
            q: lang === 'ar' ? 'كيف تعمل إضافات الحماية (Shields)؟' : 'How do the Security Shield add-ons work?',
            a: lang === 'ar' ? 'تُطبق إضافات الحماية على كل فرع بشكل مستقل. درع الثقة يمنع التقييمات من الحسابات غير الموثقة برقم هاتف، بينما درع الفاتورة يجبر المشتكين على إرفاق إيصال الشراء لمنع الشكاوى الكيدية.' : 'Shield add-ons apply per-location. The Trust Shield blocks reviews from non-SMS verified accounts, while the Fatora Shield forces complainants to attach a purchase receipt to prevent malicious reviews.'
        },
        {
            q: lang === 'ar' ? 'لدي سلسلة مطاعم، ما هي الباقة الأنسب لي؟' : 'I own a restaurant chain. Which plan is best for me?',
            a: lang === 'ar' ? 'باقة (برو - Tier 2) هي الخيار الأمثل لك. تتيح لك إدارة فروع غير محدودة من حساب واحد، وإضافة مدراء الفروع كأعضاء فريق لإدارة كل فرع على حدة.' : 'The Pro Tier 2 is perfect for you. It allows you to manage unlimited locations from one account and invite branch managers as team members to handle specific locations.'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Minimalist Hero */}
            <section className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 pt-32 pb-24 px-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        {lang === 'ar' ? 'تحكم في سمعة نشاطك التجاري.' : 'Take Control of Your Business Reputation.'}
                    </h1>
                    <p className="text-xl md:text-2xl text-blue-200 mb-10 max-w-3xl mx-auto">
                        {lang === 'ar'
                            ? 'انضم إلى منصة تقدير للشركاء. تفاعل مع العملاء، امنع التقييمات الوهمية، وزد من مبيعاتك من خلال أدوات مبنية خصيصاً لنجاحك.'
                            : 'Join the Tagdeer Merchant Platform. Engage customers, block fake reviews, and boost sales with tools built for your success.'}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/merchant/login">
                            <Button size="lg" className="h-14 px-8 text-lg font-bold bg-white text-blue-900 hover:bg-slate-100 shadow-xl rounded-full w-full sm:w-auto">
                                {lang === 'ar' ? 'سجل كشريك الآن' : 'Sign up as a Merchant'}
                            </Button>
                        </Link>
                        <Link href="#pricing">
                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-white/30 text-white hover:bg-white/10 rounded-full w-full sm:w-auto">
                                {lang === 'ar' ? 'عرض الباقات' : 'View Pricing Plans'}
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Benefits Row */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {benefits.map((benefit, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                                {benefit.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{benefit.title}</h3>
                            <p className="text-slate-600 dark:text-slate-400">{benefit.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Merchant Pricing Section */}
            <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">
                        {lang === 'ar' ? 'اختر قوة حسابك الشريك' : 'Choose Your Merchant Power'}
                    </h2>
                    <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        {lang === 'ar'
                            ? 'باقات مرنة تناسب مشروعك الأول، أو سلسلة فروعك الكبيرة. يمكنك الترقية وقتما تشاء.'
                            : 'Flexible tiers that fit your first startup, or your massive chain. Upgrade whenever you need.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
                    {/* Tier 1 */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-10 hover:shadow-xl transition-shadow relative flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Tier 1 (Base)</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Perfect for single-location businesses.</p>
                        </div>
                        <div className="mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-5xl font-black text-slate-900 dark:text-white">{priceTier1} <span className="text-2xl font-bold">LYD</span></span>
                            <span className="text-slate-500"> / mo</span>
                        </div>
                        <ul className="space-y-5 mb-10 flex-1">
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-500 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300">Manage 1 Business Location</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-500 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300">Accept Reviews & Interactions</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-500 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300">Detailed Performance Dashboard</span>
                            </li>
                            <li className="flex items-start gap-4 opacity-40">
                                <Check className="w-6 h-6 shrink-0" />
                                <span className="line-through">Team Management & Access Control</span>
                            </li>
                        </ul>
                        <Link href="/merchant/login">
                            <Button className="w-full py-6 text-lg rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 font-bold transition-colors">
                                {lang === 'ar' ? 'ابدأ الآن' : 'Start with Base'}
                            </Button>
                        </Link>
                    </div>

                    {/* Tier 2 */}
                    <div className="bg-gradient-to-b from-indigo-900 to-slate-900 rounded-3xl border border-indigo-500 shadow-2xl shadow-indigo-500/20 p-10 relative flex flex-col transform md:-translate-y-6">
                        <div className="absolute top-0 right-10 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-5 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                            <Crown className="w-4 h-4" /> MOST POPULAR
                        </div>
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-white mb-2">Tier 2 (Pro)</h3>
                            <p className="text-indigo-200 text-sm">For growing brands and multiple branches.</p>
                        </div>
                        <div className="mb-8 pb-8 border-b border-indigo-500/30">
                            <span className="text-5xl font-black text-white">{priceTier2} <span className="text-2xl font-bold">LYD</span></span>
                            <span className="text-indigo-200"> / mo</span>
                        </div>
                        <ul className="space-y-5 mb-10 flex-1">
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                <span className="text-slate-100">Manage Unlimited Locations</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                <span className="text-slate-100 font-semibold">Unlock Team Management</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                <span className="text-slate-100">Priority Support & Account Manager</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                <span className="text-slate-100">Early Access to New Features</span>
                            </li>
                        </ul>
                        <Link href="/merchant/login">
                            <Button className="w-full py-6 text-lg rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold transition-colors shadow-lg shadow-indigo-500/30 border-0">
                                {lang === 'ar' ? 'الترقية إلى برو' : 'Go Pro'}
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Shield Add-ons */}
                <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-sm">
                    <div className="text-center mb-12">
                        <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-4">
                            {lang === 'ar' ? 'تحصين الفروع: إضافات درع الحماية' : 'Location Armor: Security Shield Add-ons'}
                        </h3>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                            {lang === 'ar' ? 'احمِ سمعة فروعك بآليات متقدمة لمكافحة الاحتيال. تُضاف رسوم الدروع كاشتراك شهري مبني على كل فرع تود تحصينه.' : 'Protect your branch reputation with advanced anti-fraud mechanics. Shield fees are applied monthly per-location.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-4 p-8 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-100 dark:border-amber-900">
                            <div className="flex justify-between items-start">
                                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-slate-900 dark:text-white">{shieldPricing.trust} LYD</div>
                                    <div className="text-sm font-medium text-slate-500">/mo per branch</div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
                                    Tagdeer Trust Shield <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">Level 1</span>
                                </h4>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Secures your branch by forcing all incoming interactions and reviews to originate strictly from SMS-verified Tagdeer user accounts, eliminating bot spam.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-8 rounded-3xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-100 dark:border-blue-900">
                            <div className="flex justify-between items-start">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-8 h-8" />
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-blue-600">{shieldPricing.fatora} LYD</div>
                                    <div className="text-sm font-medium text-slate-500">/mo per branch</div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
                                    Tagdeer Fatora Shield <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold border-0">Level 2</span>
                                </h4>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">The ultimate protection. Requires physical receipt photo uploads for users to submit negative complaints. Unlocks the advanced Dispute Manager portal to challenge fake reviews directly.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Merchant FAQs */}
            <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
                    {lang === 'ar' ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
                </h2>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                        >
                            <button
                                className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none"
                                onClick={() => toggleFaq(index)}
                            >
                                <span className={`font-semibold ${isRTL ? 'text-right' : 'text-left'} text-slate-800 dark:text-slate-200 ${openFaqIndex === index ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    {faq.q}
                                </span>
                                {openFaqIndex === index ? (
                                    <ChevronUp className="w-5 h-5 text-blue-600 shrink-0" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                                )}
                            </button>

                            {openFaqIndex === index && (
                                <div className={`px-6 pb-6 pt-0 ${isRTL ? 'text-right' : 'text-left'} text-slate-600 dark:text-slate-400 animate-in slide-in-from-top-2 duration-200`}>
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 p-8 rounded-3xl">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                        {lang === 'ar' ? 'مستعد لتحويل الزبائن إلى سفراء علامتك التجارية؟' : 'Ready to turn customers into brand ambassadors?'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {lang === 'ar' ? 'أنشئ حسابك الشريك الآن، وأثبت ملكية نشاطك لتبدأ في بضع دقائق.' : 'Create your merchant account now, verify your business ownership, and get started in minutes.'}
                    </p>
                    <Link href="/merchant/login">
                        <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10">
                            {lang === 'ar' ? 'ابدأ كشريك بحساب مجاني' : 'Sign up for a Tagdeer Account'} <ArrowRight className={`ml-2 w-4 h-4 ${isRTL ? 'rotate-180 mr-2 ml-0' : ''}`} />
                        </Button>
                    </Link>
                </div>
            </section>

        </div>
    );
}
