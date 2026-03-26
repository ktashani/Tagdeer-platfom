'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Coupon Campaign Builder — Merchant tool for creating
 * promotional coupon campaigns for their business.
 *
 * Creates campaigns in the `campaigns` table and allows
 * setting discount type, quantity, expiry, and targeting.
 */

export default function CampaignsPage() {
  const [business, setBusiness] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_coupons: '',
    expires_at: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('claimed_by', session.user.id)
        .limit(1)
        .single();

      if (!biz) { setLoading(false); return; }
      setBusiness(biz);

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id, title, description, discount_type, discount_value, max_coupons, used_coupons, status, created_at, expires_at')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false });

      setCampaigns(campaignData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!business) return;
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          business_id: business.id,
          title: form.title,
          description: form.description || null,
          discount_type: form.discount_type,
          discount_value: parseFloat(form.discount_value) || 0,
          max_coupons: parseInt(form.max_coupons) || 100,
          used_coupons: 0,
          status: 'active',
          expires_at: form.expires_at || null,
        })
        .select()
        .single();

      if (error) throw error;

      setCampaigns(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', discount_type: 'percentage', discount_value: '', max_coupons: '', expires_at: '' });
    } catch (err) {
      console.error('Campaign creation error:', err);
    }
    setSaving(false);
  };

  const toggleCampaign = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">حملات الكوبونات</h1>
          <p className="text-sm text-slate-500">أنشئ حملات ترويجية لجذب الزبائن</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2"
        >
          {showForm ? '✕ إلغاء' : '+ حملة جديدة'}
        </button>
      </div>

      {/* Create Campaign Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in slide-in-from-top-2 duration-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">حملة جديدة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">عنوان الحملة *</label>
              <input
                type="text"
                value={form.title}
                onChange={handleChange('title')}
                placeholder="مثال: خصم 20% على أول زيارة"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label>
              <textarea
                value={form.description}
                onChange={handleChange('description')}
                placeholder="تفاصيل الحملة والشروط..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none h-20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">نوع الخصم</label>
              <select
                value={form.discount_type}
                onChange={handleChange('discount_type')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (LYD)</option>
                <option value="gift">هدية مجانية</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {form.discount_type === 'percentage' ? 'النسبة (%)' :
                 form.discount_type === 'fixed' ? 'المبلغ (LYD)' : 'وصف الهدية'}
              </label>
              <input
                type={form.discount_type === 'gift' ? 'text' : 'number'}
                value={form.discount_value}
                onChange={handleChange('discount_value')}
                placeholder={form.discount_type === 'percentage' ? '20' : form.discount_type === 'fixed' ? '10' : 'قهوة مجانية'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">عدد الكوبونات</label>
              <input
                type="number"
                value={form.max_coupons}
                onChange={handleChange('max_coupons')}
                placeholder="100"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">تاريخ الانتهاء</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={handleChange('expires_at')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <button
              type="submit"
              disabled={saving || !form.title}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
              إنشاء الحملة 🚀
            </button>
          </div>
        </form>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد حملات بعد</h3>
          <p className="text-sm text-slate-500 mb-4">أنشئ حملتك الأولى لجذب الزبائن بالكوبونات</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            + أنشئ حملة
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => {
            const usage = campaign.max_coupons > 0
              ? Math.round(((campaign.used_coupons || 0) / campaign.max_coupons) * 100)
              : 0;
            const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();

            return (
              <div key={campaign.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">{campaign.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                        isExpired ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        campaign.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isExpired ? 'منتهية' : campaign.status === 'active' ? 'نشطة' : 'متوقفة'}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-slate-500 mb-2">{campaign.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
                        {campaign.discount_type === 'percentage' ? `${campaign.discount_value}%` :
                         campaign.discount_type === 'fixed' ? `${campaign.discount_value} LYD` :
                         'هدية'}
                      </span>
                      <span>{campaign.used_coupons || 0} / {campaign.max_coupons} مستخدم</span>
                      {campaign.expires_at && (
                        <span>ينتهي: {new Date(campaign.expires_at).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  {!isExpired && (
                    <button
                      onClick={() => toggleCampaign(campaign.id, campaign.status)}
                      className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        campaign.status === 'active'
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {campaign.status === 'active' ? '⏸ إيقاف' : '▶ تفعيل'}
                    </button>
                  )}
                </div>
                {/* Usage bar */}
                <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      usage >= 90 ? 'bg-red-400' : usage >= 50 ? 'bg-amber-400' : 'bg-blue-400'
                    }`}
                    style={{ width: `${usage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
