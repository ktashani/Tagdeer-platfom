'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { calculateBusinessScore } from '@/lib/mathEngine';

/**
 * Business Public Profile / Storefront
 *
 * This is the page consumers see when they:
 * - Scan a business QR code
 * - Click on a business from the discover page
 * - Visit /business/[id] directly
 *
 * Shows: Business info, Gader Index, recent logs, coupon offers,
 * and a "Give Tagdeer" call-to-action.
 */

export default function BusinessProfilePage() {
  const params = useParams();
  const businessId = params?.id;

  const [business, setBusiness] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!businessId) return;

    const fetchBusiness = async () => {
      try {
        // Fetch business details
        const { data: biz, error: bizErr } = await supabase
          .from('businesses')
          .select('id, name, category, region, address, phone, email, external_url, claimed_by, is_shielded, created_at, description, operating_hours, instagram, facebook, website')
          .eq('id', businessId)
          .single();

        if (bizErr) throw bizErr;
        setBusiness(biz);

        // Fetch logs for this business
        const { data: logData } = await supabase
          .from('logs')
          .select('id, interaction_type, reason_text, created_at, is_verified')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50);

        setLogs(logData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-500 text-sm">جاري تحميل الصفحة...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">العمل غير موجود</h1>
          <p className="text-slate-500 text-sm mb-6">{error || 'لم يتم العثور على هذا العمل في تقدير'}</p>
          <a href="/discover" className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
            تصفح الأعمال
          </a>
        </div>
      </div>
    );
  }

  const { gaderIndex, rawRecommends, rawComplains } = calculateBusinessScore(
    logs.map(l => ({ ...l, interaction_type: l.interaction_type }))
  );
  const totalVotes = rawRecommends + rawComplains;
  const safeIndex = totalVotes === 0 ? 50 : (isNaN(gaderIndex) ? 50 : gaderIndex);
  const avatarLetter = business.name?.charAt(0).toUpperCase() || '?';

  const getCategoryGradient = (category) => {
    const gradients = {
      'Electronics': 'from-blue-500 to-indigo-600',
      'Tech & Telecommunication': 'from-blue-500 to-indigo-600',
      'Healthcare': 'from-emerald-500 to-teal-600',
      'Pharmacy': 'from-emerald-500 to-teal-600',
      'Café & Restaurants': 'from-amber-500 to-orange-600',
      'Bakery': 'from-amber-500 to-orange-600',
      'Beauty & Salon': 'from-pink-500 to-rose-600',
      'Supermarket': 'from-green-500 to-emerald-600',
    };
    return gradients[category] || 'from-slate-600 to-slate-800';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${getCategoryGradient(business.category)} relative overflow-hidden`}>
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold text-white shadow-lg border border-white/20">
              {avatarLetter}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{business.name}</h1>
                {business.claimed_by && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
                    ✓ موثق
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-white/80 text-sm">
                {business.city && (
                  <span className="flex items-center gap-1">
                    📍 {business.city}
                  </span>
                )}
                {business.category && (
                  <span className="bg-white/15 px-2.5 py-0.5 rounded-lg text-xs">
                    {business.category}
                  </span>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              {business.phone && (
                <a href={`tel:${business.phone}`} className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors text-white backdrop-blur-sm">
                  📞
                </a>
              )}
              {business.external_url && (
                <a href={business.external_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors text-white backdrop-blur-sm">
                  🌐
                </a>
              )}
              {business.instagram && (
                <a href={`https://instagram.com/${business.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors text-white backdrop-blur-sm">
                  📸
                </a>
              )}
              {business.facebook && (
                <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors text-white backdrop-blur-sm">
                  📘
                </a>
              )}
              <button
                onClick={() => {
                  navigator.share?.({
                    title: business.name,
                    text: `تقدير: ${business.name} — مؤشر القدر ${safeIndex}%`,
                    url: window.location.href,
                  }).catch(() => {});
                }}
                className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors text-white backdrop-blur-sm"
              >
                🔗
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gader Index Card */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                totalVotes === 0 ? 'bg-slate-100 text-slate-400' :
                safeIndex >= 70 ? 'bg-emerald-100 text-emerald-700' :
                safeIndex >= 40 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {totalVotes === 0 ? '—' : `${safeIndex}%`}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">مؤشر القدر</h2>
                <p className="text-sm text-slate-500">
                  {totalVotes === 0 ? 'لا توجد تقييمات بعد' :
                   `بناءً على ${totalVotes} تقدير`}
                </p>
              </div>
            </div>

            {/* Vote summary */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{rawRecommends}</div>
                <div className="text-xs text-slate-500 font-medium">👍 توصية</div>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{rawComplains}</div>
                <div className="text-xs text-slate-500 font-medium">👎 شكوى</div>
              </div>
            </div>
          </div>

          {/* Tug-of-war bar */}
          {totalVotes > 0 && (
            <div className="mt-4 w-full rounded-full h-3 overflow-hidden flex shadow-inner bg-slate-100">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 transition-all duration-1000"
                style={{ width: `${safeIndex}%` }}
              />
              <div
                className="bg-gradient-to-r from-red-400 to-red-500 h-3 transition-all duration-1000"
                style={{ width: `${100 - safeIndex}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm mb-6">
          {[
            { key: 'overview', label: 'نظرة عامة', icon: '📋' },
            { key: 'reviews', label: 'التقييمات', icon: '💬' },
            { key: 'info', label: 'معلومات', icon: 'ℹ️' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4 mb-10">
            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white text-center shadow-lg">
              <h3 className="text-xl font-bold mb-2">أعطهم تقديرك</h3>
              <p className="text-blue-100 text-sm mb-4">شاركنا تجربتك مع {business.name}</p>
              <div className="flex gap-3 justify-center">
                <a
                  href={`/discover?vote=${business.id}&type=recommend`}
                  className="px-6 py-2.5 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-colors shadow-sm"
                >
                  👍 أوصي
                </a>
                <a
                  href={`/discover?vote=${business.id}&type=complain`}
                  className="px-6 py-2.5 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors backdrop-blur-sm border border-white/20"
                >
                  👎 شكوى
                </a>
              </div>
            </div>

            {/* Recent logs preview */}
            {logs.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">أحدث التقييمات</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4 flex items-start gap-3">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        log.interaction_type === 'recommend' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {log.interaction_type === 'recommend' ? '👍' : '👎'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">{log.reason_text || (log.interaction_type === 'recommend' ? 'توصية' : 'شكوى')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">
                            {new Date(log.created_at).toLocaleDateString('ar-LY')}
                          </span>
                          {log.is_verified && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">✓ موثق</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {logs.length > 5 && (
                  <div className="p-4 border-t border-slate-100 text-center">
                    <button
                      onClick={() => setActiveTab('reviews')}
                      className="text-sm text-blue-600 font-medium hover:text-blue-700"
                    >
                      عرض كل {logs.length} تقدير →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3 mb-10">
            {logs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-slate-500">لا توجد تقييمات بعد</p>
                <p className="text-sm text-slate-400 mt-1">كن أول من يعطي تقديره</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
                  <span className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    log.interaction_type === 'recommend' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {log.interaction_type === 'recommend' ? '👍' : '👎'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800">{log.reason_text || (log.interaction_type === 'recommend' ? 'توصية' : 'شكوى')}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      {log.is_verified && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium border border-blue-100">✓ موثق</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-4 mb-10">
            {/* Description */}
            {business.description && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">📝 عن النشاط</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{business.description}</p>
              </div>
            )}

            {/* Contact & Links */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="divide-y divide-slate-100">
                {business.address && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">📍</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">العنوان</p>
                      <p className="text-sm text-slate-800">{business.address}</p>
                    </div>
                  </div>
                )}
                {business.phone && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">📞</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">هاتف</p>
                      <a href={`tel:${business.phone}`} className="text-sm text-blue-600 font-medium" dir="ltr">{business.phone}</a>
                    </div>
                  </div>
                )}
                {business.email && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">✉️</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">بريد إلكتروني</p>
                      <a href={`mailto:${business.email}`} className="text-sm text-blue-600 font-medium" dir="ltr">{business.email}</a>
                    </div>
                  </div>
                )}
                {(business.website || business.external_url) && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">🌐</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">الموقع</p>
                      <a href={business.website || business.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-medium" dir="ltr">
                        {(business.website || business.external_url).replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                )}
                {business.instagram && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg text-white">📸</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">إنستغرام</p>
                      <a href={`https://instagram.com/${business.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-medium" dir="ltr">
                        @{business.instagram.replace('@', '')}
                      </a>
                    </div>
                  </div>
                )}
                {business.facebook && (
                  <div className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg text-white">📘</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">فيسبوك</p>
                      <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-medium" dir="ltr">
                        {business.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, '')}
                      </a>
                    </div>
                  </div>
                )}
                <div className="p-4 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">📅</span>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">تاريخ التسجيل</p>
                    <p className="text-sm text-slate-800">
                      {new Date(business.created_at).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            {business.operating_hours && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">🕐 ساعات العمل</h3>
                <div className="space-y-2">
                  {[{k:'sun',l:'الأحد'},{k:'mon',l:'الإثنين'},{k:'tue',l:'الثلاثاء'},{k:'wed',l:'الأربعاء'},{k:'thu',l:'الخميس'},{k:'fri',l:'الجمعة'},{k:'sat',l:'السبت'}].map(day => {
                    const h = business.operating_hours[day.k];
                    if (!h) return null;
                    return (
                      <div key={day.k} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-700 font-medium w-20">{day.l}</span>
                        {h.open ? (
                          <span className="text-sm text-emerald-600 font-medium" dir="ltr">{h.from} — {h.to}</span>
                        ) : (
                          <span className="text-sm text-slate-400">مغلق</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
