'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Merchant Analytics Dashboard
 *
 * Shows: Gader Index trend, vote breakdown, daily activity chart,
 * top feedback themes, and coupon performance metrics.
 */

export default function AnalyticsPage() {
  const [business, setBusiness] = useState(null);
  const [logs, setLogs] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30'); // days

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Get merchant's business
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('claimed_by', session.user.id)
        .limit(1)
        .single();

      if (!biz) { setLoading(false); return; }
      setBusiness(biz);

      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      // Fetch logs for period
      const { data: logData } = await supabase
        .from('logs')
        .select('id, type, text, created_at, is_verified, is_flagged')
        .eq('business_id', biz.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      setLogs(logData || []);

      // Fetch coupon stats
      const { data: couponData } = await supabase
        .from('user_coupons')
        .select('id, status, created_at')
        .eq('business_id', biz.id)
        .gte('created_at', since.toISOString());

      setCoupons(couponData || []);
      setLoading(false);
    };

    fetchAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Computations
  const recommends = logs.filter(l => l.type === 'recommend' && !l.is_flagged);
  const complains = logs.filter(l => l.type === 'complain' && !l.is_flagged);
  const verifiedCount = logs.filter(l => l.is_verified).length;
  const totalValid = recommends.length + complains.length;
  const gaderIndex = totalValid === 0 ? 50 : Math.round((recommends.length / totalValid) * 100);
  const couponRedeemed = coupons.filter(c => c.status === 'REDEEMED').length;
  const couponTotal = coupons.length;

  // Daily breakdown for the mini bar chart
  const dailyMap = {};
  logs.forEach(log => {
    const day = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!dailyMap[day]) dailyMap[day] = { recommend: 0, complain: 0 };
    if (log.type === 'recommend') dailyMap[day].recommend++;
    else dailyMap[day].complain++;
  });
  const dailyData = Object.entries(dailyMap).slice(-14); // last 14 days with data
  const maxDaily = Math.max(1, ...dailyData.map(([, d]) => d.recommend + d.complain));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تحليلات {business?.name}</h1>
          <p className="text-sm text-slate-500">أداء عملك في الفترة المحددة</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { value: '7', label: '7 أيام' },
            { value: '30', label: '30 يوم' },
            { value: '90', label: '90 يوم' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPeriod(opt.value); setLoading(true); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          label="مؤشر القدر"
          value={`${gaderIndex}%`}
          icon="⚡"
          color={gaderIndex >= 70 ? 'emerald' : gaderIndex >= 40 ? 'amber' : 'red'}
        />
        <KPICard label="إجمالي التقييمات" value={totalValid} icon="📊" color="blue" />
        <KPICard label="التوصيات" value={recommends.length} icon="👍" color="emerald" />
        <KPICard label="الشكاوى" value={complains.length} icon="👎" color="red" />
        <KPICard label="تقييمات موثقة" value={verifiedCount} icon="✓" color="indigo" />
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">النشاط اليومي</h2>
        {dailyData.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <div className="text-3xl mb-2">📈</div>
            <p>لا يوجد نشاط في هذه الفترة</p>
          </div>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {dailyData.map(([day, data]) => {
              const total = data.recommend + data.complain;
              const height = (total / maxDaily) * 100;
              const recPct = total > 0 ? (data.recommend / total) * 100 : 50;
              return (
                <div key={day} className="flex-1 min-w-[2rem] flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex flex-col justify-end" style={{ height: '128px' }}>
                    <div
                      className="w-full rounded-t-md overflow-hidden transition-all group-hover:opacity-90"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    >
                      <div className="bg-emerald-400 w-full" style={{ height: `${recPct}%` }} />
                      <div className="bg-red-400 w-full" style={{ height: `${100 - recPct}%` }} />
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">{day}</span>
                  {/* Tooltip */}
                  <div className="hidden group-hover:block absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow">
                    {data.recommend}👍 {data.complain}👎
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" /> توصيات</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400 inline-block" /> شكاوى</span>
        </div>
      </div>

      {/* Two-column: Coupons + Recent Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coupon Performance */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">أداء الكوبونات</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{couponTotal}</p>
              <p className="text-xs text-blue-600 mt-1">إجمالي الكوبونات</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{couponRedeemed}</p>
              <p className="text-xs text-emerald-600 mt-1">مستخدمة</p>
            </div>
          </div>
          {couponTotal > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${(couponRedeemed / couponTotal) * 100}%` }}
              />
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2 text-center">
            نسبة الاستخدام: {couponTotal > 0 ? Math.round((couponRedeemed / couponTotal) * 100) : 0}%
          </p>
        </div>

        {/* Recent Feedback */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">أحدث التقييمات</h2>
          {logs.length === 0 ? (
            <div className="text-center text-slate-400 py-6">
              <p>لا توجد تقييمات في هذه الفترة</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {logs.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className={`text-sm mt-0.5 ${log.type === 'recommend' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {log.type === 'recommend' ? '👍' : '👎'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{log.text || (log.type === 'recommend' ? 'توصية' : 'شكوى')}</p>
                    <span className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric' })}
                      {log.is_verified && ' ✓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}
