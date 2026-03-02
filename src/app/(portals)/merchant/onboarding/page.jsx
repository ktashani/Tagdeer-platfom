"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Store, UploadCloud, AlertCircle, Clock, Check, Crown, ShieldAlert, ShieldCheck, CreditCard, CheckCircle2, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getPresignedUploadUrl } from '@/app/actions/storage';

const CATEGORIES = [
    "Supermarket", "Pharmacy", "Café & Restaurants", "Bakery",
    "Healthcare", "Electronics", "Tech & Telecommunication", "Construction",
    "Home Maintenance", "Automotive", "Beauty & Salon", "Real Estate",
    "Education", "Travel", "Fashion & Retail", "Services", "Food & Beverage", "Delivery & Shipping"
];
const REGIONS = ["Tripoli", "Benghazi"];

export default function MerchantOnboarding() {
    const router = useRouter();
    const { supabase, user, showToast, t, lang, isRTL } = useTagdeer();

    // Wizard State
    const [step, setStep] = useState(1);

    // Step 1: Business Details
    const [businessData, setBusinessData] = useState({ name: '', category: '', region: 'Tripoli' });
    const [documents, setDocuments] = useState(null);

    // Step 2: Shields (0 = None, 1 = Trust[20 LYD], 2 = Fatora[50 LYD])
    const [shieldLevel, setShieldLevel] = useState(0);

    // Step 3: Checkout
    const [paymentMethod, setPaymentMethod] = useState('online'); // 'online' or 'manual'
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pricing Math
    // Note: Tier pricing is handled in the Dashboard popup before reaching here.
    const shieldPrice = shieldLevel === 1 ? 20 : (shieldLevel === 2 ? 50 : 0);
    const total = shieldPrice;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setDocuments(e.target.files[0]);
        }
    };

    const submitOrder = async () => {
        setIsSubmitting(true);
        try {
            if (!user) throw new Error("Authentication required");

            // 1. Upload Verification Document tracking
            let documentUrl = null;
            let fileMetadata = { size: null, type: null };

            if (documents) {
                // Get Presigned URL directly from Next.js server actions
                const uploadInit = await getPresignedUploadUrl({
                    folder: 'merchant_documents',
                    filename: documents.name,
                    contentType: documents.type || 'application/octet-stream' // fallback
                });

                if (!uploadInit?.success || !uploadInit.uploadUrl) {
                    throw new Error("Failed to initialize secure upload");
                }

                // Actually upload the file straight to R2 from the browser using the signed URL
                const response = await fetch(uploadInit.uploadUrl, {
                    method: 'PUT',
                    body: documents,
                    headers: {
                        'Content-Type': documents.type || 'application/octet-stream'
                    }
                });

                if (!response.ok) {
                    throw new Error("Failed to upload document to R2 storage");
                }

                documentUrl = uploadInit.objectKey;
                fileMetadata = {
                    size: documents.size,
                    type: documents.type || 'application/octet-stream'
                };
            }

            // 2. Create the Unverified Business record
            const { data: businessObj, error: bError } = await supabase
                .from('businesses')
                .insert([{
                    name: businessData.name,
                    category: businessData.category,
                    region: businessData.region,
                    claimed_by: user.id,
                    is_shielded: shieldLevel > 0,
                    source: 'Merchant Onboarding'
                }])
                .select('id')
                .single();

            if (bError) throw new Error("Business creation failed: " + bError.message);

            // 3. Create the Business Claim
            const { error: claimError } = await supabase
                .from('business_claims')
                .insert([{
                    business_id: businessObj.id,
                    user_id: user.id,
                    status: 'pending',
                    document_url: documentUrl,
                    file_size: fileMetadata.size,
                    mime_type: fileMetadata.type
                }]);

            if (claimError) throw new Error("Claim submission failed: " + claimError.message);

            // 4. Record the requested Financial Upgrade (if applicable)
            if (shieldLevel > 0) {
                const amount = shieldLevel === 1 ? 20 : 50;
                await supabase.from('transactions').insert([{
                    business_id: businessObj.id,
                    user_id: user.id,
                    amount: amount,
                    status: paymentMethod === 'manual' ? 'pending' : 'completed',
                    payment_method: paymentMethod,
                    requested_tier: shieldLevel === 1 ? 'Tier 1' : 'Tier 2',
                    duration: '1 Month'
                }]);
            }

            // 5. Elevate User Role to Merchant
            await supabase
                .from('profiles')
                .update({ role: 'merchant' })
                .eq('id', user.id);

            setStep(4);
            if (showToast) showToast(t('registration_submitted') || 'Registration submitted successfully!');
        } catch (error) {
            console.error(error);
            if (showToast) showToast(error.message || 'Failed to process. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center pt-8 pb-20 px-4" dir={isRTL ? 'rtl' : 'ltr'}>

            <div className="w-full max-w-4xl">
                {/* Header & Progress */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                        {t('merchant_onboarding')}
                    </h1>

                    {/* Progress Bar */}
                    <div className="flex justify-between items-center relative max-w-2xl mx-auto">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -z-10 -translate-y-1/2 rounded-full"></div>
                        <div
                            className={`absolute top-1/2 h-1 bg-blue-600 -z-10 -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out ${isRTL ? 'right-0' : 'left-0'}`}
                            style={{ width: `${((Math.min(step, 3) - 1) / 2) * 100}%` }}
                        ></div>

                        {/* Dots */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 ${step >= i ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                                {step > i ? <Check className="w-5 h-5" /> : i}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between max-w-2xl mx-auto mt-3 text-xs font-medium text-slate-500 px-2 lg:px-4">
                        <span>{t('onboarding_details')}</span>
                        <span>{t('onboarding_shields')}</span>
                        <span>{t('onboarding_checkout')}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden min-h-[500px] relative">

                    {/* STEP 1: BUSINESS DETAILS */}
                    {step === 1 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <Store className={`w-6 h-6 text-indigo-500 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('business_details_title')}
                            </h2>
                            <p className="text-slate-500 mb-8">{t('business_details_desc')}</p>

                            <div className="space-y-6 max-w-2xl">
                                <div className="space-y-2">
                                    <Label>{t('legal_business_name')}</Label>
                                    <Input placeholder="e.g., Al-Saha Clinic" value={businessData.name} onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })} className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t('category')}</Label>
                                        <select
                                            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.4c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095.3c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat"
                                            value={businessData.category}
                                            onChange={(e) => setBusinessData({ ...businessData, category: e.target.value })}
                                            style={{ backgroundPosition: isRTL ? 'left 12px center' : 'right 12px center' }}
                                        >
                                            <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('region')}</Label>
                                        <select
                                            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.4c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095.3c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat"
                                            value={businessData.region}
                                            onChange={(e) => setBusinessData({ ...businessData, region: e.target.value })}
                                            style={{ backgroundPosition: isRTL ? 'left 12px center' : 'right 12px center' }}
                                        >
                                            {REGIONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label className="mb-3 block">{t('verification_doc')}</Label>
                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group hover:border-blue-400 relative">
                                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
                                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <UploadCloud className="w-8 h-8" />
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{documents ? documents.name : t('click_to_upload')}</span>
                                        <p className="text-xs text-slate-500 mt-2">PDF, JPG, PNG (Max 5MB)</p>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6">
                                    <Button size="lg" disabled={!businessData.name || !businessData.category || !documents} onClick={() => setStep(2)} className="rounded-full px-8 bg-blue-600 shadow-lg shadow-blue-500/20">
                                        {t('continue_to_addons')} {isRTL ? <span className="mr-2">←</span> : <span className="ml-2">→</span>}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SHIELDS */}
                    {step === 2 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col h-full">
                            <Button variant="ghost" className={`self-start -ml-4 mb-4 text-slate-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'}`} onClick={() => setStep(1)}>{isRTL ? '→' : '←'} {t('back')}</Button>

                            <h2 className="text-2xl font-bold mb-2">{t('enhance_shields')}</h2>
                            <p className="text-slate-500 mb-8 max-w-xl">{t('shield_desc').replace('{name}', businessData.name || (lang === 'ar' ? 'هذا النشاط' : 'this location'))}</p>

                            <div className="space-y-4 mb-10">
                                <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between ${shieldLevel >= 1 ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 shadow-lg shadow-amber-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><ShieldCheck className="w-8 h-8" /></div>
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 text-lg">{t('trust_shield')} <Badge variant="outline" className="bg-amber-100 border-0 text-amber-700 font-bold px-3 py-0.5 rounded-full">{lang === 'ar' ? 'المستوى 1' : 'Level 1'}</Badge></h3>
                                            <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{t('trust_shield_desc')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between border-t border-amber-100 sm:border-0 pt-4 sm:pt-0">
                                        <div className={isRTL ? 'text-left' : 'text-right'}>
                                            <div className="font-black text-xl text-slate-900 dark:text-white">{t('price_per_month').replace('{price}', '20')}</div>
                                        </div>
                                        <Switch checked={shieldLevel >= 1} onCheckedChange={(c) => setShieldLevel(c ? (shieldLevel === 2 ? 2 : 1) : 0)} className="data-[state=checked]:bg-amber-500 scale-110" />
                                    </div>
                                </div>

                                <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between ${shieldLevel === 2 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg shadow-blue-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><ShieldAlert className="w-8 h-8" /></div>
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 text-lg">{t('fatora_shield')} <Badge variant="outline" className="bg-blue-100 border-0 text-blue-700 font-bold px-3 py-0.5 rounded-full">{lang === 'ar' ? 'المستوى 2' : 'Level 2'}</Badge></h3>
                                            <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{t('fatora_shield_desc')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between border-t border-blue-100 sm:border-0 pt-4 sm:pt-0">
                                        <div className={isRTL ? 'text-left' : 'text-right'}>
                                            <div className="font-black text-xl text-slate-900 dark:text-white">{t('price_per_month').replace('{price}', '50')}</div>
                                        </div>
                                        <Switch checked={shieldLevel === 2} onCheckedChange={(c) => setShieldLevel(c ? 2 : 1)} disabled={shieldLevel === 0} className="data-[state=checked]:bg-blue-600 scale-110" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-8 mt-auto">
                                <span className="text-sm font-bold text-slate-400 border-b border-dashed border-slate-300 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => setStep(3)}>{t('skip_addons')}</span>
                                <Button size="lg" onClick={() => setStep(3)} className="rounded-full px-8 bg-slate-900 dark:bg-slate-800 text-white shadow-xl">
                                    {t('review_checkout')} {isRTL ? <span className="mr-2">←</span> : <span className="ml-2">→</span>}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CHECKOUT */}
                    {step === 3 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500 overflow-y-auto">
                            <Button variant="ghost" className={`self-start -ml-4 mb-4 text-slate-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${isRTL ? 'mr-auto ml-0' : 'ml-auto mr-0'}`} onClick={() => setStep(2)}>{isRTL ? '→' : '←'} {t('back')}</Button>

                            <h2 className="text-2xl font-bold mb-2">{t('review_checkout')}</h2>
                            <p className="text-slate-500 mb-8">{t('checkout_summary')}</p>

                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                <div className="lg:col-span-3 space-y-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center"><User className="w-6 h-6" /></div>
                                                <div className={isRTL ? 'text-right' : 'text-left'}>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{t('active_tier')}</p>
                                                    <p className="font-bold text-slate-900 dark:text-white">Professional Account</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1 rounded-full border-0">{t('tier_desc')}</Badge>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500">{lang === 'ar' ? `النشاط: ${businessData.name}` : `Business: ${businessData.name}`}</span>
                                                <span className="font-medium">{t(businessData.region)}</span>
                                            </div>
                                            {shieldLevel > 0 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">{shieldLevel === 1 ? t('trust_shield') : t('fatora_shield')}</span>
                                                    <span className="font-medium text-blue-600">{shieldLevel === 1 ? '20' : '50'} LYD</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <span className="font-bold text-lg">{t('total_monthly')}</span>
                                                <span className="font-black text-2xl text-blue-600">{total} LYD</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-base font-bold text-slate-700 dark:text-slate-300 px-1 block">{t('payment_method')}</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div
                                                onClick={() => setPaymentMethod('online')}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-3 group ${paymentMethod === 'online' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${paymentMethod === 'online' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                        <CreditCard className="w-6 h-6" />
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 p-1 flex items-center justify-center ${paymentMethod === 'online' ? 'border-blue-600' : 'border-slate-300'}`}>
                                                        {paymentMethod === 'online' && <div className="w-full h-full bg-blue-600 rounded-full" />}
                                                    </div>
                                                </div>
                                                <span className={`font-bold ${paymentMethod === 'online' ? 'text-blue-900 dark:text-blue-400' : 'text-slate-600'}`}>{t('pay_online')}</span>
                                            </div>
                                            <div
                                                onClick={() => setPaymentMethod('manual')}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-3 group ${paymentMethod === 'manual' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${paymentMethod === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 p-1 flex items-center justify-center ${paymentMethod === 'manual' ? 'border-blue-600' : 'border-slate-300'}`}>
                                                        {paymentMethod === 'manual' && <div className="w-full h-full bg-blue-600 rounded-full" />}
                                                    </div>
                                                </div>
                                                <span className={`font-bold ${paymentMethod === 'manual' ? 'text-blue-900 dark:text-blue-400' : 'text-slate-600'}`}>{t('manual_billing')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2">
                                    <div className="bg-slate-900 text-white rounded-3xl p-8 sticky top-0 shadow-2xl overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/40 transition-colors duration-700"></div>
                                        <h3 className="text-xl font-bold mb-4 relative z-10">{t('ready')}</h3>
                                        <p className="text-slate-400 text-sm mb-8 leading-relaxed relative z-10">
                                            {paymentMethod === 'online' ? t('online_desc') : t('manual_desc')}
                                        </p>

                                        <Button
                                            size="lg"
                                            className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6 text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all relative z-10"
                                            onClick={submitOrder}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    {lang === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                                                </div>
                                            ) : (
                                                paymentMethod === 'online' ? t('proceed_payment') : t('submit_request')
                                            )}
                                        </Button>
                                        <p className="text-[10px] text-slate-500 mt-6 text-center italic relative z-10">By clicking, you agree to Tagdeer Business Terms of Focus and Merchant Guidelines.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 4 && (
                        <div className="p-12 text-center animate-in zoom-in duration-500 flex flex-col items-center justify-center h-[500px]">
                            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-black mb-3">{t('success_title')}</h2>
                            {paymentMethod === 'online' ? (
                                <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">{t('success_online').replace('{name}', businessData.name)}</p>
                            ) : (
                                <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">{t('success_manual').replace('{name}', businessData.name)}</p>
                            )}

                            <Button size="lg" onClick={() => router.push('/merchant/dashboard')} className="px-10 rounded-full bg-slate-900 border-0 hover:bg-slate-800 shadow-xl">
                                {t('enter_dashboard')}
                            </Button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
