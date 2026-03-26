"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Wallet, CreditCard, Clock, CheckCircle2, XCircle,
    ArrowUpRight, Receipt, ShieldCheck, Store, Sparkles,
    AlertCircle, Loader2, FileText
} from "lucide-react";
import { useTagdeer } from '@/context/TagdeerContext';
import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG = {
    pending:   { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    completed: { label: 'Approved',       color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    rejected:  { label: 'Declined',       color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
};

const GATEWAY_LABELS = {
    manual_bank:  'Bank Transfer',
    crypto_usdt:  'USDT',
    tlync_lyd:    'Tlync',
};

export default function MerchantBilling() {
    const { user, supabase, showToast, lang = 'en' } = useTagdeer();
    const { activeBusiness } = useActiveBusiness();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [subscription, setSubscription] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [quotaUsage, setQuotaUsage] = useState({ locationsUsed: 0, shieldsAssigned: 0, storefrontsAssigned: 0 });
    const [gatewayEnabled, setGatewayEnabled] = useState(false);

    useEffect(() => {
        if (!user || !supabase) return;

        const fetchBillingData = async () => {
            setIsLoading(true);
            try {
                const [subRes, txnRes, auditRes, quotaRes, gwRes] = await Promise.all([
                    // Active subscription
                    supabase
                        .from('subscriptions')
                        .select('*')
                        .eq('profile_id', user.id)
                        .in('status', ['Active', 'Expiring Soon', 'Grace Period', 'Pending'])
                        .maybeSingle(),
                    // Transaction history
                    supabase
                        .from('transactions')
                        .select('id, requested_tier, upgrade_from_tier, amount, currency, payment_method, payment_gateway, status, rejection_reason, created_at, confirmed_at, duration')
                        .eq('owner_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(50),
                    // Audit trail
                    supabase
                        .from('payment_audit_log')
                        .select('id, action, old_status, new_status, metadata, created_at')
                        .order('created_at', { ascending: false })
                        .limit(20),
                    // Quota usage counts
                    Promise.all([
                        supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('claimed_by', user.id),
                        supabase.from('feature_allocations').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('feature_type', 'shield').eq('status', 'active'),
                        supabase.from('feature_allocations').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('feature_type', 'storefront').eq('status', 'active'),
                    ]),
                    // Payment gateway config
                    supabase.from('platform_config').select('value').eq('key', 'payment_gateway_config').maybeSingle(),
                ]);

                if (subRes.data) setSubscription(subRes.data);
                if (txnRes.data) setTransactions(txnRes.data);
                if (auditRes.data) setAuditLog(auditRes.data);

                const [bizCount, shieldCount, storefrontCount] = quotaRes;
                setQuotaUsage({
                    locationsUsed: bizCount.count || 0,
                    shieldsAssigned: shieldCount.count || 0,
                    storefrontsAssigned: storefrontCount.count || 0,
                });

                if (gwRes.data?.value?.enabled) {
                    setGatewayEnabled(true);
                }

                // ── GAP 4: Check for recently resolved requests → toast ──
                const lastCheck = localStorage.getItem('tagdeer_billing_last_check');
                if (lastCheck && txnRes.data) {
                    const recentlyResolved = txnRes.data.filter(t =>
                        (t.status === 'completed' || t.status === 'rejected') &&
                        t.confirmed_at &&
                        new Date(t.confirmed_at) > new Date(lastCheck)
                    );
                    recentlyResolved.forEach(t => {
                        if (t.status === 'completed') {
                            showToast?.(lang === 'ar'
                                ? `تمت الموافقة على طلب الترقية إلى ${t.requested_tier}! 🎉`
                                : `Your upgrade to ${t.requested_tier} was approved! 🎉`);
                        } else if (t.status === 'rejected') {
                            showToast?.(lang === 'ar'
                                ? `تم رفض طلب الترقية. السبب: ${t.rejection_reason || 'غير محدد'}`
                                : `Upgrade request declined. Reason: ${t.rejection_reason || 'Not specified'}`, 'error');
                        }
                    });
                }
                localStorage.setItem('tagdeer_billing_last_check', new Date().toISOString());

            } catch (err) {
                console.error('Billing data fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBillingData();
    }, [user, supabase]);

    const quotas = subscription?.quotas || {};
    const maxLocations = quotas.max_locations ?? 1;
    const maxShields = quotas.max_shields ?? 0;
    const maxStorefronts = quotas.max_storefronts ?? 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                        {lang === 'ar' ? 'الفواتير والمدفوعات' : 'Billing & Payments'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ar' ? 'تتبع طلبات الترقية والمدفوعات' : 'Track your upgrade requests, payments, and subscription details.'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => router.push('/merchant/settings?tab=subscription')}
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    {lang === 'ar' ? 'ترقية الباقة' : 'Upgrade Plan'}
                </Button>
            </div>

            {/* ─── Section 1: Active Subscription Summary ─── */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        {lang === 'ar' ? 'الباقة الحالية' : 'Current Plan'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {subscription ? (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800">
                                        {subscription.tier}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {subscription.status === 'Active' && subscription.expires_at
                                            ? `${lang === 'ar' ? 'ينتهي في' : 'Expires'} ${new Date(subscription.expires_at).toLocaleDateString()}`
                                            : subscription.status}
                                    </p>
                                </div>
                                <Badge className={`text-sm px-3 py-1 ${subscription.status === 'Active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : subscription.status === 'Expiring Soon'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {subscription.status}
                                </Badge>
                            </div>

                            {/* Quota Usage Bars */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <QuotaBar
                                    icon={Store}
                                    label={lang === 'ar' ? 'المواقع' : 'Locations'}
                                    used={quotaUsage.locationsUsed}
                                    max={maxLocations}
                                />
                                <QuotaBar
                                    icon={ShieldCheck}
                                    label={lang === 'ar' ? 'الدروع' : 'Shields'}
                                    used={quotaUsage.shieldsAssigned}
                                    max={maxShields}
                                />
                                <QuotaBar
                                    icon={Store}
                                    label={lang === 'ar' ? 'واجهات العرض' : 'Storefronts'}
                                    used={quotaUsage.storefrontsAssigned}
                                    max={maxStorefronts}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <Wallet className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium">
                                {lang === 'ar' ? 'لا توجد باقة فعّالة' : 'No active subscription'}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                {lang === 'ar' ? 'قم بترقية باقتك للحصول على ميزات متقدمة' : 'Upgrade your plan to unlock advanced features'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Section 2: Transaction History ─── */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                        <Receipt className="w-5 h-5 text-amber-500" />
                        {lang === 'ar' ? 'سجل الطلبات' : 'Transaction History'}
                        {transactions.length > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                                {transactions.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {transactions.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium">
                                {lang === 'ar' ? 'لا توجد طلبات بعد' : 'No transactions yet'}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                {lang === 'ar' ? 'طلبات الترقية ستظهر هنا' : 'Upgrade requests will appear here'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {transactions.map(txn => {
                                const cfg = STATUS_CONFIG[txn.status] || STATUS_CONFIG.pending;
                                const StatusIcon = cfg.icon;
                                return (
                                    <div key={txn.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${cfg.color}`}>
                                                <StatusIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">
                                                    {txn.upgrade_from_tier && (
                                                        <span className="text-slate-400 font-normal">{txn.upgrade_from_tier} → </span>
                                                    )}
                                                    {txn.requested_tier}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {new Date(txn.created_at).toLocaleDateString()} • {txn.duration} • {GATEWAY_LABELS[txn.payment_gateway] || txn.payment_method}
                                                </p>
                                                {txn.status === 'rejected' && txn.rejection_reason && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        {txn.rejection_reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-700 text-sm whitespace-nowrap">
                                                {txn.amount} {txn.currency || 'LYD'}
                                            </span>
                                            <Badge variant="outline" className={`text-[11px] border ${cfg.color}`}>
                                                {cfg.label}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Section 3: Payment Method Placeholder ─── */}
            <Card className="border-slate-200 shadow-sm border-dashed">
                <CardHeader className="border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                        <CreditCard className="w-5 h-5 text-blue-500" />
                        {lang === 'ar' ? 'طرق الدفع' : 'Payment Methods'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {gatewayEnabled ? (
                        <div className="text-center py-4">
                            <p className="text-slate-600 font-medium">
                                {lang === 'ar' ? 'الدفع الإلكتروني متاح' : 'Online payment is available'}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                {lang === 'ar' ? 'يمكنك الدفع مباشرة عند طلب الترقية' : 'You can pay directly when requesting an upgrade'}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                                <CreditCard className="w-7 h-7 text-blue-300" />
                            </div>
                            <p className="text-slate-500 font-medium">
                                {lang === 'ar' ? 'الدفع الإلكتروني قريباً' : 'Online payment coming soon'}
                            </p>
                            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                                {lang === 'ar'
                                    ? 'حالياً، تتم معالجة جميع الترقيات عبر التحويل البنكي. بمجرد تفعيل بوابة الدفع، ستتمكن من الدفع مباشرة.'
                                    : 'Currently, all upgrades are processed via bank transfer. Once a payment gateway is activated, you\'ll be able to pay directly online.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Quota Usage Bar Component ─── */
function QuotaBar({ icon: Icon, label, used, max }) {
    const isUnlimited = max === -1;
    const percent = isUnlimited ? 0 : max > 0 ? Math.min((used / max) * 100, 100) : 0;
    const isFull = !isUnlimited && max > 0 && used >= max;

    return (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isFull ? 'text-red-500' : 'text-indigo-500'}`} />
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                </div>
                <span className="text-xs font-bold text-slate-500">
                    {used}/{isUnlimited ? '∞' : max}
                </span>
            </div>
            {!isUnlimited && (
                <Progress
                    value={percent}
                    className={`h-2 ${isFull ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-500'}`}
                />
            )}
            {isUnlimited && (
                <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-indigo-400 to-purple-400 animate-pulse" />
                </div>
            )}
        </div>
    );
}
