'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * MerchantOnboarding — Guided wizard for new merchants after claim approval.
 *
 * Steps:
 *   1. Welcome + business overview
 *   2. Upload logo + cover photo
 *   3. Complete business contact info
 *   4. Choose subscription tier (or confirm Free)
 *   5. Launch checklist
 *
 * Only shows when the merchant hasn't completed onboarding.
 * Persists progress to profiles.metadata.onboarding_step
 */

const STEPS = [
  { key: 'welcome', title: 'مرحباً بك في تقدير للأعمال', titleEn: 'Welcome to Tagdeer Business' },
  { key: 'branding', title: 'هوية عملك', titleEn: 'Your Brand Identity' },
  { key: 'contact', title: 'معلومات التواصل', titleEn: 'Contact Information' },
  { key: 'plan', title: 'اختر باقتك', titleEn: 'Choose Your Plan' },
  { key: 'launch', title: 'أنت جاهز!', titleEn: 'You\'re Ready!' },
];

export default function MerchantOnboarding({ business, profile, onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    logo: null,
    cover: null,
    phone: profile?.phone || '',
    email: profile?.email || '',
    address: business?.address || '',
    website: '',
    facebook: business?.external_url || '',
    instagram: '',
  });

  // Persist step progress
  useEffect(() => {
    const savedStep = profile?.metadata?.onboarding_step;
    if (savedStep && savedStep < STEPS.length - 1) {
      setStep(savedStep);
    }
  }, [profile]);

  const saveProgress = async (nextStep) => {
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...(profile?.metadata || {}),
            onboarding_step: nextStep,
          }
        })
        .eq('id', profile?.id);
    } catch (e) {
      console.error('Failed to save onboarding progress:', e);
    }
    setSaving(false);
  };

  const handleNext = async () => {
    const nextStep = step + 1;
    await saveProgress(nextStep);
    if (nextStep >= STEPS.length) {
      // Mark onboarding complete
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...(profile?.metadata || {}),
            onboarding_complete: true,
            onboarding_step: STEPS.length,
          }
        })
        .eq('id', profile?.id);
      onComplete?.();
      return;
    }
    setStep(nextStep);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleContactSave = async () => {
    setSaving(true);
    try {
      // Update business contact info
      if (business?.id) {
        await supabase
          .from('businesses')
          .update({
            phone: formData.phone || undefined,
            email: formData.email || undefined,
            address: formData.address || undefined,
            website: formData.website || undefined,
            external_url: formData.facebook || undefined,
          })
          .eq('id', business.id);
      }
    } catch (e) {
      console.error('Failed to save contact info:', e);
    }
    setSaving(false);
    handleNext();
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-white' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Step header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
                {step + 1}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{currentStep.title}</h2>
                <p className="text-sm text-slate-500">{currentStep.titleEn}</p>
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="p-8">
            {step === 0 && (
              <WelcomeStep business={business} profile={profile} />
            )}
            {step === 1 && (
              <BrandingStep formData={formData} setFormData={setFormData} />
            )}
            {step === 2 && (
              <ContactStep formData={formData} setFormData={setFormData} />
            )}
            {step === 3 && (
              <PlanStep />
            )}
            {step === 4 && (
              <LaunchStep business={business} />
            )}
          </div>

          {/* Actions */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← السابق
            </button>

            <div className="text-xs text-slate-400">
              {step + 1} / {STEPS.length}
            </div>

            <button
              onClick={step === 2 ? handleContactSave : handleNext}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              )}
              {step === STEPS.length - 1 ? 'ابدأ الآن 🚀' : 'التالي →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Step Components ────────────────────────────────────

function WelcomeStep({ business, profile }) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-2xl font-bold text-slate-900 mb-2">
        تهانينا، {profile?.full_name || 'التاجر'}!
      </h3>
      <p className="text-slate-500 mb-6 max-w-md mx-auto">
        تمت الموافقة على طلبك لإدارة <span className="font-semibold text-blue-600">{business?.name || 'عملك'}</span>.
        دعنا نساعدك في إعداد ملفك التجاري في بضع خطوات بسيطة.
      </p>
      <div className="bg-blue-50 rounded-2xl p-6 text-right max-w-md mx-auto border border-blue-100">
        <h4 className="font-semibold text-blue-900 mb-3 text-lg">ما ستحصل عليه:</h4>
        <ul className="space-y-3 text-sm text-blue-800">
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            صفحة عمل احترافية على تقدير
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            مؤشر القدر — سمعة رقمية حقيقية
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            أدوات لإدارة العروض و الكوبونات
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            تحليلات عن تقييمات الزبائن
          </li>
        </ul>
      </div>
    </div>
  );
}

function BrandingStep({ formData, setFormData }) {
  return (
    <div className="space-y-6">
      <p className="text-slate-500 text-sm mb-4">
        أضف شعار وصورة غلاف لعملك لجعل صفحتك مميزة ومهنية.
      </p>

      {/* Logo upload */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">شعار العمل</label>
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer group">
          <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
          <p className="text-sm text-slate-500">اسحب الصورة هنا أو اضغط للاختيار</p>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG — 500×500 مستحسن</p>
        </div>
      </div>

      {/* Cover upload */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">صورة الغلاف</label>
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer group">
          <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🏞️</div>
          <p className="text-sm text-slate-500">اسحب الصورة هنا أو اضغط للاختيار</p>
          <p className="text-xs text-slate-400 mt-1">1200×400 مستحسن</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">يمكنك تخطي هذه الخطوة وإضافة الصور لاحقاً</p>
    </div>
  );
}

function ContactStep({ formData, setFormData }) {
  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-sm mb-2">
        أكمل معلومات التواصل لتمكين الزبائن من الوصول إليك.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">رقم الهاتف</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={handleChange('phone')}
            placeholder="+218 91 XXXXXXX"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">البريد الإلكتروني</label>
          <input
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            placeholder="info@yourbusiness.ly"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            dir="ltr"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">العنوان</label>
          <input
            type="text"
            value={formData.address}
            onChange={handleChange('address')}
            placeholder="شارع المدار، طرابلس"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">صفحة الفيسبوك</label>
          <input
            type="url"
            value={formData.facebook}
            onChange={handleChange('facebook')}
            placeholder="https://facebook.com/yourbusiness"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">الإنستغرام</label>
          <input
            type="url"
            value={formData.instagram}
            onChange={handleChange('instagram')}
            placeholder="https://instagram.com/yourbusiness"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            dir="ltr"
          />
        </div>
      </div>
    </div>
  );
}

function PlanStep() {
  const [selected, setSelected] = useState('free');

  const plans = [
    {
      id: 'free',
      name: 'مجاني',
      nameEn: 'Free',
      price: '0',
      features: ['موقع واحد', 'صفحة عمل أساسية', 'مؤشر القدر'],
      badge: 'الحالي',
    },
    {
      id: 'growth',
      name: 'نمو',
      nameEn: 'Growth',
      price: '49',
      features: ['3 مواقع', 'واجهة متجر', 'حملات كوبونات', 'تحليلات متقدمة'],
      badge: 'شائع',
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: 'مؤسسة',
      nameEn: 'Enterprise',
      price: '149',
      features: ['مواقع غير محدودة', 'درع السمعة', 'دعم VIP', 'API مخصص'],
      badge: null,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-sm">
        أنت حالياً على الباقة المجانية. يمكنك الترقية في أي وقت.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan.id)}
            className={`relative p-5 rounded-2xl border-2 text-right transition-all ${
              selected === plan.id
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            } ${plan.highlighted ? 'ring-2 ring-blue-200' : ''}`}
          >
            {plan.badge && (
              <span className={`absolute -top-2.5 right-3 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                plan.id === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'
              }`}>
                {plan.badge}
              </span>
            )}
            <div className="text-lg font-bold text-slate-900">{plan.name}</div>
            <div className="text-xs text-slate-400 mb-2">{plan.nameEn}</div>
            <div className="text-2xl font-bold text-blue-600 mb-3">
              {plan.price} <span className="text-sm font-normal text-slate-400">LYD/شهر</span>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map((f, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-blue-500">✓</span> {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        لا يتطلب الأمر بطاقة ائتمان — ابدأ مجاناً وارتقِ عندما تكون جاهزاً
      </p>
    </div>
  );
}

function LaunchStep({ business }) {
  const checklist = [
    { label: 'تم تسجيل عملك', done: true },
    { label: 'تمت الموافقة على الطلب', done: true },
    { label: 'تم إعداد الاشتراك المجاني', done: true },
    { label: 'أكمل معلومات التواصل', done: true },
    { label: 'أنشئ أول حملة كوبونات', done: false },
    { label: 'شارك صفحتك على فيسبوك', done: false },
  ];

  return (
    <div className="text-center">
      <div className="text-6xl mb-4">🚀</div>
      <h3 className="text-2xl font-bold text-slate-900 mb-2">
        صفحة {business?.name || 'عملك'} جاهزة!
      </h3>
      <p className="text-slate-500 mb-6">
        إليك الخطوات المقترحة للحصول على أقصى استفادة:
      </p>

      <div className="bg-slate-50 rounded-2xl p-5 text-right max-w-md mx-auto border border-slate-100">
        <ul className="space-y-3">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              {item.done ? (
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">✓</span>
              ) : (
                <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-400">{i + 1}</span>
              )}
              <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
