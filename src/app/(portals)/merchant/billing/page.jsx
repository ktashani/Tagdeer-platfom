'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Merchant Billing & Subscription Management
 *
 * Shows: current plan, usage quotas, upgrade options, payment history.
 * Payment gateway: stub for Sadad / Mobi Cash / Tlync integration.
 */

const TIER_FEATURES = {
  Free: {
    color: 'slate', icon: '🆓',
    features: ['موقع واحد', 'صفحة عمل أساسية', 'مؤشر القدر'],
  },
  Growth: {
    color: 'blue', icon: '📈',
    features: ['3 مواقع', 'واجهة متجر', 'حملات كوبونات', 'تحليلات متقدمة', 'دعم أولوية'],
  },
  Enterprise: {
    color: 'purple', icon: '🏢',
    features: ['مواقع غير محدودة', 'درع السمعة', 'دعم VIP', 'API مخصص', 'تقارير مخصصة'],
  },
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Fetch current subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, tier, status, expires_at, quotas')
        .eq('profile_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(sub);

      // Fetch available tiers
      const { data: tierData } = await supabase
        .from('subscription_tiers')
        .select('id, name, price, description, allocations')
        .order('price', { ascending: true });

      setTiers(tierData || []);

      // Fetch transaction history (upgrade requests)
      const { data: txnData } = await supabase
        .from('transactions')
        .select('id, requested_tier, amount, payment_gateway, status, rejection_reason, created_at')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setPayments(txnData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleUpgradeRequest = (tier) => {
    setPaymentModal(tier);
  };

  const handlePaymentSubmit = async (method) => {
    if (!paymentModal) return;
    setUpgrading(paymentModal.name);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Insert into transactions table → flows through admin PaymentQueue
      const { error } = await supabase
        .from('transactions')
        .insert({
          owner_id: session.user.id,
          business_id: subscription?.business_id || null,
          requested_tier: paymentModal.name,
          amount: paymentModal.price || 0,
          payment_method: 'manual',
          payment_gateway: method,
          status: 'pending',
        });

      if (error) throw error;

      // Refresh payment history
      const { data: txnData } = await supabase
        .from('transactions')
        .select('id, requested_tier, amount, payment_gateway, status, rejection_reason, created_at')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setPayments(txnData || []);
      setPaymentModal(null);
    } catch (err) {
      console.error('Payment error:', err);
      alert('فشل في إرسال الطلب: ' + err.message);
    }
    setUpgrading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const currentTier = subscription?.tier || 'Free';
  const tierInfo = TIER_FEATURES[currentTier] || TIER_FEATURES.Free;
  const daysLeft = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at) - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Current Plan */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">الفواتير والاشتراك</h1>
        <p className="text-sm text-slate-500">إدارة اشتراكك وسجل المدفوعات</p>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{tierInfo.icon}</span>
              <h2 className="text-xl font-bold">الباقة الحالية: {currentTier}</h2>
            </div>
            <p className="text-blue-100 text-sm">
              {subscription?.status === 'Active'
                ? `نشط${daysLeft !== null ? ` — ${daysLeft} يوم متبقي` : ''}`
                : 'مجاني — لا حدود زمنية'}
            </p>
          </div>
          {subscription?.status === 'Active' && daysLeft !== null && daysLeft <= 7 && (
            <div className="bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 px-4 py-2 rounded-xl">
              <span className="text-amber-200 text-sm font-medium">⚠️ ينتهي خلال {daysLeft} أيام</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-blue-200 text-xs">المواقع</p>
            <p className="text-lg font-bold">{subscription?.quotas?.max_locations || 1}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-blue-200 text-xs">الحملات</p>
            <p className="text-lg font-bold">{subscription?.quotas?.max_campaigns || 0}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-blue-200 text-xs">الكوبونات</p>
            <p className="text-lg font-bold">{subscription?.quotas?.max_coupons || 0}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-blue-200 text-xs">الحالة</p>
            <p className="text-lg font-bold">{subscription?.status === 'Active' ? '✅' : '🆓'}</p>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">الباقات المتاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const info = TIER_FEATURES[tier.name] || {};
            const isCurrent = tier.name === currentTier;
            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border-2 p-6 transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    الحالي
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{info.icon || '📦'}</span>
                  <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-4">
                  {tier.price || 0} <span className="text-sm font-normal text-slate-400">LYD/شهر</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {(info.features || []).map((f, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-blue-500 text-xs">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && tier.price > 0 && (
                  <button
                    onClick={() => handleUpgradeRequest(tier)}
                    disabled={upgrading === tier.name}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {upgrading === tier.name && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    )}
                    الترقية →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">سجل المدفوعات</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {payments.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <div className="text-3xl mb-2">💳</div>
              <p>لا توجد مدفوعات بعد</p>
            </div>
          ) : (
          <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">الباقة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">المبلغ</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الطريقة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{p.requested_tier}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{p.amount} LYD</td>
                    <td className="px-6 py-4 text-slate-600">{p.payment_gateway || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        p.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {p.status === 'completed' ? 'مؤكد ✅' : p.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                      </span>
                      {p.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">{p.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(p.created_at).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">الترقية إلى {paymentModal.name}</h3>
            <p className="text-sm text-slate-500 mb-6">{paymentModal.price} LYD/شهر</p>

            <div className="space-y-3">
              <button
                onClick={() => handlePaymentSubmit('sadad')}
                className="w-full p-4 border-2 border-slate-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-xl font-bold text-green-700 group-hover:scale-110 transition-transform">
                  S
                </div>
                <div className="text-right flex-1">
                  <p className="font-semibold text-slate-900">سداد</p>
                  <p className="text-xs text-slate-500">الدفع عبر سداد الإلكتروني</p>
                </div>
              </button>

              <button
                onClick={() => handlePaymentSubmit('mobi_cash')}
                className="w-full p-4 border-2 border-slate-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-700 group-hover:scale-110 transition-transform">
                  M
                </div>
                <div className="text-right flex-1">
                  <p className="font-semibold text-slate-900">موبي كاش</p>
                  <p className="text-xs text-slate-500">الدفع عبر المحفظة الإلكترونية</p>
                </div>
              </button>

              <button
                onClick={() => handlePaymentSubmit('bank_transfer')}
                className="w-full p-4 border-2 border-slate-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600 group-hover:scale-110 transition-transform">
                  🏦
                </div>
                <div className="text-right flex-1">
                  <p className="font-semibold text-slate-900">تحويل بنكي</p>
                  <p className="text-xs text-slate-500">تحويل يدوي — يحتاج تأكيد الإدارة</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setPaymentModal(null)}
              className="w-full mt-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
