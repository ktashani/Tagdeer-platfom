'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Globe, Search, AlertTriangle, CheckCircle2, Loader2, Info, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddBusinessRoute() {
    const {
        t, lang, supabase, businesses, setBusinesses,
        showToast, categories = [], regions = [], user, isRTL
    } = useTagdeer();

    const isAr = lang === 'ar';
    const router = useRouter();

    const [newBizInput, setNewBizInput] = useState('');
    const [newBizRegion, setNewBizRegion] = useState('');
    const [newBizCategory, setNewBizCategory] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Duplicate check state
    const [duplicates, setDuplicates] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasCheckedDuplicates, setHasCheckedDuplicates] = useState(false);

    useEffect(() => {
        const regionNames = regions.map(r => typeof r === 'string' ? r : r.name);
        const categoryNames = categories.map(c => typeof c === 'string' ? c : c.name);

        if (regionNames.length > 0 && !newBizRegion) setNewBizRegion(regionNames[0]);
        if (categoryNames.length > 0 && !newBizCategory) setNewBizCategory(categoryNames[0]);
    }, [regions, categories, newBizRegion, newBizCategory]);

    // Debounced duplicate check
    const checkDuplicates = useCallback(async (query) => {
        if (!supabase || !query || query.length < 2) {
            setDuplicates([]);
            setHasCheckedDuplicates(false);
            return;
        }
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('id, name, region, category, claimed_by')
                .ilike('name', `%${query}%`)
                .limit(5);

            if (!error && data) {
                setDuplicates(data);
            }
            setHasCheckedDuplicates(true);
        } catch (err) {
            console.error('Duplicate check error:', err);
        } finally {
            setIsSearching(false);
        }
    }, [supabase]);

    useEffect(() => {
        const timer = setTimeout(() => {
            checkDuplicates(newBizInput);
        }, 400);
        return () => clearTimeout(timer);
    }, [newBizInput, checkDuplicates]);

    const handleSubmit = async () => {
        if (!newBizInput.trim()) {
            return showToast(isAr ? 'يرجى إدخال اسم النشاط التجاري' : 'Please enter a business name');
        }
        if (!agreedToTerms) {
            return showToast(isAr ? 'يرجى الموافقة على شروط الدليل المجتمعي' : 'Please agree to the community directory terms');
        }

        setIsSubmitting(true);
        try {
            if (supabase) {
                const insertData = {
                    name: newBizInput.trim(),
                    region: newBizRegion,
                    category: newBizCategory,
                    source: 'Community Directory',
                    created_by: user?.id || null
                };

                const { data, error } = await supabase
                    .from('businesses')
                    .insert([insertData])
                    .select();

                if (error) {
                    showToast(isAr ? 'فشل في إنشاء النشاط. حاول مرة أخرى.' : 'Failed to create business. Please try again.');
                    console.error('Business creation error:', error);
                    return;
                }

                if (data) {
                    setBusinesses([...businesses, { ...data[0], recommends: 0, complains: 0, logs: [] }]);
                    showToast(isAr ? 'تم إضافة النشاط بنجاح! 🎉' : 'Business added successfully! 🎉');
                    router.push('/discover');
                }
            }
        } catch (err) {
            console.error(err);
            showToast(isAr ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Community Directory Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-amber-800 mb-1">
                            {isAr ? 'إشعار مهم — الدليل المجتمعي' : 'Important Notice — Community Directory'}
                        </p>
                        <p className="text-amber-700 text-sm leading-relaxed">
                            {isAr
                                ? 'أنت تضيف نشاطًا تجاريًا إلى دليل تقدير المجتمعي. هذا لا يمثل ملكية أو انتساب. يمكن لصاحب النشاط المطالبة بهذا الملف في أي وقت عبر بوابة التاجر.'
                                : 'You are adding a business to the Tagdeer community directory. This does NOT represent ownership or affiliation. The business owner may claim this listing at any time through the Merchant Portal.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Globe className="h-8 w-8 text-blue-700" />
                    </div>
                    <h1 className="text-3xl font-bold text-blue-900 mb-2">{t('add_page_title')}</h1>
                    <p className="text-slate-500 text-sm max-w-md mx-auto">
                        {isAr
                            ? 'أضف نشاطًا تجاريًا للدليل المجتمعي ليتمكن الآخرون من مشاركة تجربتهم'
                            : 'Add a business to the community directory so others can share their experiences'}
                    </p>
                </div>

                <div className="space-y-5 max-w-lg mx-auto">

                    {/* Duplicate Check Reminder */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                        <Search className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 leading-relaxed">
                            {isAr
                                ? 'يرجى التأكد من عدم وجود النشاط مسبقًا قبل الإضافة (بالعربية أو الإنجليزية). اكتب الاسم أدناه وسنبحث لك تلقائيًا.'
                                : 'Please check if the business already exists before adding it (in Arabic or English). Type the name below and we\'ll search automatically.'}
                        </p>
                    </div>

                    {/* Business Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block">
                            {isAr ? 'اسم النشاط التجاري' : 'Business Name'}
                        </label>
                        <div className="relative">
                            <Store className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} w-5 h-5 text-slate-400`} />
                            <input
                                type="text"
                                value={newBizInput}
                                onChange={(e) => setNewBizInput(e.target.value)}
                                placeholder={isAr ? 'مثال: مطعم السراج' : 'e.g., Al-Siraj Restaurant'}
                                className={`w-full px-12 py-4 rounded-xl border border-slate-300 outline-none bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base`}
                            />
                            {isSearching && (
                                <Loader2 className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-5 h-5 text-blue-500 animate-spin`} />
                            )}
                        </div>
                    </div>

                    {/* Duplicate Results */}
                    {hasCheckedDuplicates && newBizInput.length >= 2 && (
                        <div className={`rounded-xl border ${duplicates.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} p-4`}>
                            {duplicates.length > 0 ? (
                                <div>
                                    <p className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {isAr ? `وجدنا ${duplicates.length} نتيجة مشابهة — هل تقصد واحداً من هؤلاء؟` : `Found ${duplicates.length} similar listing(s) — did you mean one of these?`}
                                    </p>
                                    <div className="space-y-2">
                                        {duplicates.map(d => (
                                            <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                                                <div>
                                                    <span className="font-semibold text-sm text-slate-800">{d.name}</span>
                                                    <span className="text-xs text-slate-500 mx-2">•</span>
                                                    <span className="text-xs text-slate-500">{t(d.region) || d.region}</span>
                                                </div>
                                                <Link
                                                    href={`/b/${d.id}`}
                                                    className="text-xs text-blue-600 hover:underline font-semibold px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    {isAr ? 'عرض' : 'View'}
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-emerald-700 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {isAr ? 'لا توجد أنشطة مشابهة — يمكنك الإضافة' : 'No similar listings found — you can add it'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Region & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">
                                {isAr ? 'المنطقة' : 'Region'}
                            </label>
                            <select
                                value={newBizRegion}
                                onChange={(e) => setNewBizRegion(e.target.value)}
                                className="w-full px-4 py-4 rounded-xl border border-slate-300 bg-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                {regions.map(r => {
                                    const val = typeof r === 'string' ? r : r.name;
                                    return <option key={val} value={val}>{t(val)}</option>;
                                })}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">
                                {isAr ? 'التصنيف' : 'Category'}
                            </label>
                            <select
                                value={newBizCategory}
                                onChange={(e) => setNewBizCategory(e.target.value)}
                                className="w-full px-4 py-4 rounded-xl border border-slate-300 bg-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                {categories.map(c => {
                                    const val = typeof c === 'string' ? c : c.name;
                                    return <option key={val} value={val}>{t(val)}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Consent Checkbox */}
                    <label className="flex items-start gap-2.5 text-xs text-slate-500 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:bg-slate-100 transition-colors">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="leading-relaxed">
                            {isAr
                                ? <>أفهم أنني أنشئ قائمة مجتمعية ولا أدعي الملكية. يمكن لصاحب النشاط المطالبة بهذه القائمة في أي وقت. أوافق على <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">شروط الاستخدام</Link>.</>
                                : <>I understand I am creating a community listing, not claiming ownership. The business owner may claim this listing at any time. I agree to the <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">Terms of Use</Link>.</>
                            }
                        </span>
                    </label>

                    {/* Reward hint for verified users */}
                    {user?.phone_verified && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5">
                            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-700 font-medium">
                                {isAr ? 'بصفتك مستخدمًا موثقًا، ستحصل على +5 قدر كمكافأة لإضافة هذا النشاط!' : 'As a verified user, you\'ll earn +5 Gader for adding this business!'}
                            </span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !agreedToTerms || !newBizInput.trim()}
                        className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                            agreedToTerms && newBizInput.trim()
                                ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> {isAr ? 'جاري الإضافة...' : 'Adding...'}</>
                        ) : (
                            <>{t('generate_profile')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
