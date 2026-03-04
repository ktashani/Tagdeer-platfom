"use client";

import React, { useEffect, useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Gift, Loader2, Store, Ticket, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ConsumerWallet() {
    const { user, supabase, loading, lang, t, isRTL } = useTagdeer();
    const router = useRouter();

    const [coupons, setCoupons] = useState([]);
    const [isLoadingCoupons, setIsLoadingCoupons] = useState(true);
    const [selectedCoupon, setSelectedCoupon] = useState(null);

    // Eligibility Check
    const isEligible = user?.status === 'Active' && user?.gader >= 50;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user && isEligible && supabase) {
            const fetchCoupons = async () => {
                setIsLoadingCoupons(true);
                try {
                    const { data, error } = await supabase
                        .from('user_coupons')
                        .select(`
                            id, serial_code, acquired_at, valid_until, status,
                            merchant_coupons (
                                id, title, offer_type, discount_value, item_name,
                                businesses ( name, region, category )
                            )
                        `)
                        .eq('profile_id', user.id)
                        .in('status', ['ACTIVE'])
                        .order('valid_until', { ascending: true }); // Closest expiry first

                    if (error) throw error;
                    setCoupons(data || []);
                } catch (err) {
                    console.error("Error fetching wallet:", err);
                } finally {
                    setIsLoadingCoupons(false);
                }
            };
            fetchCoupons();
        } else {
            setIsLoadingCoupons(false);
        }
    }, [user, isEligible, supabase]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isEligible) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
                <div className="max-w-md w-full text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-10 h-10 text-slate-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {lang === 'ar' ? 'المحفظة مقفلة' : 'Wallet Locked'}
                    </h1>
                    <p className="text-slate-500">
                        {lang === 'ar'
                            ? 'لفتح محفظة الخصومات والمكافآت، يجب أن يكون حسابك نشطاً وأن تمتلك على الأقل 50 نقطة تقدير.'
                            : 'To unlock your rewards wallet, your account must be Active and you need at least 50 Gader Points.'}
                    </p>
                    <div className="pt-6">
                        <Button onClick={() => router.push('/discover')} className="rounded-full px-8">
                            {lang === 'ar' ? 'اكتشف الأنشطة واكسب النقاط' : 'Discover Places & Earn Points'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const renderCouponCard = (coupon) => {
        const mc = coupon.merchant_coupons;
        const biz = mc.businesses;
        const couponName = mc.offer_type === 'free_item' ? mc.item_name : `${mc.discount_value}${mc.offer_type === 'percentage' ? '%' : ' LYD'} Off`;

        // Check Hot Coupon status (< 48 hours from acquired)
        const ageHours = (new Date() - new Date(coupon.acquired_at)) / (1000 * 60 * 60);
        const isHot = ageHours < 48;
        const hoursLeftForHot = Math.max(0, 48 - ageHours).toFixed(1);

        const expiryDate = new Date(coupon.valid_until);
        const daysToExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysToExpiry <= 3;

        return (
            <Card
                key={coupon.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-all border-slate-200 dark:border-slate-800 group"
                onClick={() => setSelectedCoupon(coupon)}
            >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 mb-3 backdrop-blur-md">
                                {mc.title || (lang === 'ar' ? 'مكافأة تقدير' : 'Tagdeer Reward')}
                            </Badge>
                            <h3 className="text-2xl font-black text-white mb-1">{couponName}</h3>
                            <p className="text-blue-100 flex items-center gap-1 text-sm font-medium">
                                <Store className="w-4 h-4" /> {biz?.name}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                            <Ticket className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>

                <CardContent className="p-4 bg-white dark:bg-slate-900 border-t border-dashed border-slate-300 dark:border-slate-700 relative">
                    {/* Semi-circles for ticket effect */}
                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-slate-50 dark:bg-slate-950 rounded-full"></div>
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-slate-50 dark:bg-slate-950 rounded-full"></div>

                    <div className="flex justify-between items-center mt-2">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                {lang === 'ar' ? 'صالح حتى' : 'Valid Until'}
                            </p>
                            <p className={`text-sm font-bold flex items-center gap-1 ${isExpiringSoon ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                                <Clock className="w-4 h-4" /> {expiryDate.toLocaleDateString()}
                            </p>
                        </div>
                        {isHot && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 flex items-center gap-1 animate-pulse">
                                <Zap className="w-3 h-3" />
                                {lang === 'ar' ? 'مكافأة مضاعفة' : '1.5x Bonus'}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Gift className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                            {lang === 'ar' ? 'محفظة المكافآت' : 'My Wallet'}
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            {lang === 'ar' ? 'استخدم تصاريح الخصم الخاصة بك قبل انتهائها.' : 'Redeem your acquired coupons before they expire.'}
                        </p>
                    </div>
                </div>

                {isLoadingCoupons ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                ) : coupons.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                            {lang === 'ar' ? 'محفظتك فارغة' : 'Your wallet is empty'}
                        </h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-6">
                            {lang === 'ar' ? 'قم بتسجيل تجاربك في الأنشطة التجارية لفتح مكافآت حصرية.' : 'Log your experiences at businesses to unlock exclusive rewards.'}
                        </p>
                        <Button onClick={() => router.push('/discover')} className="rounded-full px-8">
                            {lang === 'ar' ? 'استكشف لتربح' : 'Discover & Earn'}
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {coupons.map(renderCouponCard)}
                    </div>
                )}
            </div>

            {/* Modal for QR Code Display */}
            {selectedCoupon && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setSelectedCoupon(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-center relative">
                            <button
                                onClick={() => setSelectedCoupon(null)}
                                className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                            >
                                ✕
                            </button>
                            <h3 className="text-2xl font-black text-white mb-2">
                                {selectedCoupon.merchant_coupons.offer_type === 'free_item'
                                    ? selectedCoupon.merchant_coupons.item_name
                                    : `${selectedCoupon.merchant_coupons.discount_value}${selectedCoupon.merchant_coupons.offer_type === 'percentage' ? '%' : ' LYD'} Off`}
                            </h3>
                            <p className="text-indigo-100 font-medium bg-black/20 inline-block px-3 py-1 rounded-full text-sm">
                                {selectedCoupon.merchant_coupons.businesses.name}
                            </p>
                        </div>

                        {/* QR Section */}
                        <div className="p-8 flex flex-col items-center bg-white relative">
                            {/* Jagged border effect */}
                            <div className="absolute top-0 left-0 right-0 h-2 bg-[url('/img/jagged-border.svg')] bg-repeat-x -mt-2"></div>

                            <p className="text-slate-500 text-sm mb-6 text-center">
                                {lang === 'ar' ? 'أظهر هذا الرمز للتاجر عند الدفع' : 'Show this QR code to the merchant at checkout'}
                            </p>

                            <div className="p-4 rounded-3xl bg-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 mb-6">
                                <QRCodeSVG
                                    value={`https://tagdeer.app/redeem/${selectedCoupon.serial_code}`}
                                    size={200}
                                    fgColor="#0f172a"
                                    level="H"
                                />
                            </div>

                            <div className="text-center w-full bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                                    {lang === 'ar' ? 'رمز القسيمة' : 'Coupon Code'}
                                </p>
                                <p className="text-xl font-mono font-black tracking-widest text-slate-800">
                                    {selectedCoupon.serial_code}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
