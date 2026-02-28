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
import { Store, UploadCloud, AlertCircle, Clock, Check, Crown, ShieldAlert, ShieldCheck, CreditCard, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MerchantOnboarding() {
    const router = useRouter();
    const { supabase, user, showToast } = useTagdeer();

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

            // 1. Upload Verification Document
            let documentUrl = null;
            if (documents) {
                const fileExt = documents.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('business_documents')
                    .upload(fileName, documents);

                if (uploadError) throw new Error("Document upload failed: " + uploadError.message);

                // Get public URL (or construct it if bucket is private and we just want to save the path)
                documentUrl = fileName;
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
                    document_url: documentUrl
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

            setStep(4);
            if (showToast) showToast('Registration submitted successfully!');
        } catch (error) {
            console.error(error);
            if (showToast) showToast(error.message || 'Failed to process. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center pt-8 pb-20 px-4">

            <div className="w-full max-w-4xl">
                {/* Header & Progress */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                        Merchant Onboarding
                    </h1>

                    {/* Progress Bar */}
                    <div className="flex justify-between items-center relative max-w-2xl mx-auto">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -z-10 -translate-y-1/2 rounded-full"></div>
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out"
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
                        <span>Details</span>
                        <span>Shields</span>
                        <span>Checkout</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden min-h-[500px] relative">

                    {/* STEP 1: BUSINESS DETAILS */}
                    {step === 1 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <Store className="w-6 h-6 text-indigo-500" /> Business Details
                            </h2>
                            <p className="text-slate-500 mb-8">Tell us about the location you are claiming today.</p>

                            <div className="space-y-6 max-w-2xl">
                                <div className="space-y-2">
                                    <Label>Legal Business Name</Label>
                                    <Input placeholder="e.g., Al-Saha Clinic" value={businessData.name} onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950" value={businessData.category} onChange={(e) => setBusinessData({ ...businessData, category: e.target.value })}>
                                            <option value="">Select...</option>
                                            <option value="Restaurant">Restaurant & Cafe</option>
                                            <option value="Healthcare">Healthcare</option>
                                            <option value="Retail">Retail</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Region</Label>
                                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950" value={businessData.region} onChange={(e) => setBusinessData({ ...businessData, region: e.target.value })}>
                                            <option value="Tripoli">Tripoli</option>
                                            <option value="Benghazi">Benghazi</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label className="mb-3 block">Verification Document (License / ID)</Label>
                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative group">
                                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
                                        <UploadCloud className="w-10 h-10 text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                        <span className="font-semibold text-sm">{documents ? documents.name : 'Click to upload document'}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6">
                                    <Button size="lg" disabled={!businessData.name || !businessData.category || !documents} onClick={() => setStep(2)}>
                                        Continue to Add-ons &rarr;
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SHIELDS */}
                    {step === 2 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col h-full">
                            <Button variant="ghost" className="self-start -ml-4 mb-4 text-slate-500" onClick={() => setStep(2)}>&larr; Back</Button>

                            <h2 className="text-2xl font-bold mb-2">Enhance with Security Shields</h2>
                            <p className="text-slate-500 mb-8 max-w-xl">These optional add-ons apply specifically to <strong>{businessData.name || 'this location'}</strong> to protect your reputation.</p>

                            <div className="space-y-4 mb-10">
                                <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between ${shieldLevel >= 1 ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 text-lg">Trust Shield <Badge variant="outline" className="bg-amber-100 border-0 text-amber-700">Level 1</Badge></h3>
                                            <p className="text-sm text-slate-500 mt-1 max-w-sm">Block ratings from unverified accounts. Users must verify via SMS.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between">
                                        <div className="text-right">
                                            <div className="font-bold text-lg">+20 LYD</div><div className="text-xs text-slate-500">per month</div>
                                        </div>
                                        <Switch checked={shieldLevel >= 1} onCheckedChange={(c) => setShieldLevel(c ? (shieldLevel === 2 ? 2 : 1) : 0)} className="data-[state=checked]:bg-amber-500" />
                                    </div>
                                </div>

                                <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between ${shieldLevel === 2 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 text-lg">Fatora Shield <Badge variant="outline" className="bg-blue-100 border-0 text-blue-700">Level 2</Badge></h3>
                                            <p className="text-sm text-slate-500 mt-1 max-w-sm">Force receipt uploads for negative complaints. Includes Trust Shield.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between">
                                        <div className="text-right">
                                            <div className="font-bold text-lg">+50 LYD</div><div className="text-xs text-slate-500">per month</div>
                                        </div>
                                        <Switch checked={shieldLevel === 2} onCheckedChange={(c) => setShieldLevel(c ? 2 : 1)} disabled={shieldLevel === 0} className="data-[state=checked]:bg-blue-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
                                <span className="text-sm font-medium text-slate-500 border-b border-dashed border-slate-400 cursor-help" onClick={() => setStep(3)}>Skip add-ons</span>
                                <Button size="lg" onClick={() => setStep(3)}>Review Checkout &rarr;</Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CHECKOUT */}
                    {step === 3 && (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-500">
                            <Button variant="ghost" className="mb-4 -ml-4 text-slate-500" onClick={() => setStep(2)}>&larr; Back</Button>

                            <h2 className="text-2xl font-bold mb-8">Checkout Summary</h2>

                            <div className="grid md:grid-cols-5 gap-8">
                                {/* Left: Review Order */}
                                <div className="md:col-span-3 space-y-6">
                                    <Card className="bg-slate-50 dark:bg-slate-900/50 shadow-none border-dashed">
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white">Active Account Tier</p>
                                                        <p className="text-sm text-slate-500">Subscription applied to account</p>
                                                    </div>
                                                    <p className="font-medium text-emerald-600">Active</p>
                                                </div>

                                                {shieldLevel > 0 && (
                                                    <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">Add-on: {shieldLevel === 1 ? 'Trust Shield' : 'Fatora Shield'}</p>
                                                            <p className="text-sm text-slate-500">Applied to: {businessData.name || 'New Business'}</p>
                                                        </div>
                                                        <p className="font-medium">{shieldPrice} LYD</p>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center pt-2">
                                                    <p className="font-bold text-lg">Total Monthly</p>
                                                    <p className="font-black text-2xl text-blue-600">{total} LYD</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-4 pt-4">
                                        <h3 className="font-bold">Payment Method</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div
                                                className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-all ${paymentMethod === 'online' ? 'border-blue-600 bg-blue-50/50 text-blue-700 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                onClick={() => setPaymentMethod('online')}
                                            >
                                                <CreditCard className="w-6 h-6 mb-1" />
                                                <span className="font-semibold text-sm">Pay Online Now</span>
                                            </div>
                                            <div
                                                className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-all ${paymentMethod === 'manual' ? 'border-amber-500 bg-amber-50/50 text-amber-700 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                onClick={() => setPaymentMethod('manual')}
                                            >
                                                <Clock className="w-6 h-6 mb-1" />
                                                <span className="font-semibold text-sm">Manual Admin Billing</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Action */}
                                <div className="md:col-span-2">
                                    <div className="bg-slate-900 rounded-3xl p-6 text-white h-full flex flex-col">
                                        <h3 className="font-bold text-xl mb-2">Ready?</h3>
                                        {paymentMethod === 'online' ? (
                                            <p className="text-slate-400 text-sm mb-8">You will be redirected to our secure payment gateway to complete your {total} LYD subscription.</p>
                                        ) : (
                                            <p className="text-slate-400 text-sm mb-8">Your request will be placed in a pending state until an admin verifies your documents and manually initiates billing.</p>
                                        )}

                                        <Button
                                            size="lg"
                                            className="w-full mt-auto bg-blue-600 hover:bg-blue-500 py-6 text-lg"
                                            onClick={submitOrder}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? 'Processing...' : (paymentMethod === 'online' ? 'Proceed to Payment' : 'Submit Request')}
                                        </Button>
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
                            <h2 className="text-3xl font-black mb-3">Welcome to Tagdeer!</h2>
                            {paymentMethod === 'online' ? (
                                <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">Your payment was successful and your business <strong>{businessData.name}</strong> is now registered securely.</p>
                            ) : (
                                <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">Your registration request has been submitted to our admins. They will review your verification documents shortly.</p>
                            )}

                            <Button size="lg" onClick={() => router.push('/merchant/dashboard')} className="px-10 rounded-full">
                                Enter Merchant Dashboard
                            </Button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
