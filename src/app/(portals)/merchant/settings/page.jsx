'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';

/**
 * Merchant Store Settings Page
 * Edit store profile: description, category, phone, social links, hours.
 */

const DAYS = [
    { key: 'sun', label: 'الأحد' },
    { key: 'mon', label: 'الإثنين' },
    { key: 'tue', label: 'الثلاثاء' },
    { key: 'wed', label: 'الأربعاء' },
    { key: 'thu', label: 'الخميس' },
    { key: 'fri', label: 'الجمعة' },
    { key: 'sat', label: 'السبت' },
];

const DEFAULT_HOURS = DAYS.reduce((acc, d) => {
    acc[d.key] = { open: true, from: '09:00', to: '21:00' };
    return acc;
}, {});

export default function MerchantSettingsPage() {
    const { myBusinesses } = useTagdeer();
    const business = myBusinesses?.[0];

    const [form, setForm] = useState({
        description: '',
        category: '',
        phone: '',
        website: '',
        instagram: '',
        facebook: '',
    });
    const [hours, setHours] = useState(DEFAULT_HOURS);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load existing business data
    useEffect(() => {
        if (!business?.id) {
            setLoading(false);
            return;
        }
        const load = async () => {
            const { data, error } = await supabase
                .from('businesses')
                .select('description, category, phone, website, instagram, facebook, operating_hours')
                .eq('id', business.id)
                .maybeSingle();

            if (data) {
                setForm({
                    description: data.description || '',
                    category: data.category || '',
                    phone: data.phone || '',
                    website: data.website || '',
                    instagram: data.instagram || '',
                    facebook: data.facebook || '',
                });
                if (data.operating_hours) {
                    setHours(prev => ({ ...prev, ...data.operating_hours }));
                }
            }
            setLoading(false);
        };
        load();
    }, [business?.id]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const toggleDay = (dayKey) => {
        setHours(prev => ({
            ...prev,
            [dayKey]: { ...prev[dayKey], open: !prev[dayKey].open },
        }));
        setSaved(false);
    };

    const updateHour = (dayKey, field, value) => {
        setHours(prev => ({
            ...prev,
            [dayKey]: { ...prev[dayKey], [field]: value },
        }));
        setSaved(false);
    };

    const handleSave = useCallback(async () => {
        if (!business?.id) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    description: form.description,
                    category: form.category,
                    phone: form.phone,
                    website: form.website,
                    instagram: form.instagram,
                    facebook: form.facebook,
                    operating_hours: hours,
                })
                .eq('id', business.id);

            if (error) throw error;
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Save error:', err);
            alert('فشل في الحفظ: ' + err.message);
        }
        setSaving(false);
    }, [business?.id, form, hours]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    if (!business) {
        return (
            <div className="text-center py-20 text-slate-400">
                <div className="text-4xl mb-3">🏪</div>
                <p>لا يوجد نشاط تجاري مرتبط بحسابك</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">إعدادات المتجر</h1>
                    <p className="text-slate-400 mt-1">{business.name}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-6 py-2.5 font-semibold rounded-xl transition-all text-sm flex items-center gap-2 ${
                        saved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:opacity-50`}
                >
                    {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : saved ? '✓ تم الحفظ' : '💾 حفظ'}
                </button>
            </div>

            {/* Store Info */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">🏪 معلومات المتجر</h3>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">الوصف</label>
                    <textarea
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="وصف مختصر لنشاطك التجاري..."
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">الفئة</label>
                        <select
                            value={form.category}
                            onChange={(e) => handleChange('category', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">اختر الفئة</option>
                            <option value="restaurant">مطعم</option>
                            <option value="cafe">مقهى</option>
                            <option value="retail">متجر تجزئة</option>
                            <option value="service">خدمات</option>
                            <option value="health">صحة وجمال</option>
                            <option value="tech">تكنولوجيا</option>
                            <option value="education">تعليم</option>
                            <option value="other">أخرى</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">رقم الهاتف</label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="+218 91..."
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            dir="ltr"
                        />
                    </div>
                </div>
            </div>

            {/* Social Links */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">🔗 روابط التواصل</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { key: 'website', label: 'الموقع الإلكتروني', placeholder: 'https://', icon: '🌐' },
                        { key: 'instagram', label: 'إنستغرام', placeholder: '@username', icon: '📸' },
                        { key: 'facebook', label: 'فيسبوك', placeholder: 'رابط الصفحة', icon: '📘' },
                    ].map(field => (
                        <div key={field.key}>
                            <label className="block text-xs text-slate-400 mb-1">{field.icon} {field.label}</label>
                            <input
                                type="text"
                                value={form[field.key]}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                dir="ltr"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Operating Hours */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">🕐 ساعات العمل</h3>
                <div className="space-y-2">
                    {DAYS.map(day => {
                        const h = hours[day.key];
                        return (
                            <div key={day.key} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                                <button
                                    onClick={() => toggleDay(day.key)}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${
                                        h.open ? 'bg-emerald-600' : 'bg-slate-600'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                        h.open ? 'translate-x-4' : 'translate-x-0.5'
                                    }`} />
                                </button>
                                <span className="text-sm text-white w-16">{day.label}</span>
                                {h.open ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <input
                                            type="time"
                                            value={h.from}
                                            onChange={(e) => updateHour(day.key, 'from', e.target.value)}
                                            className="px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-xs outline-none"
                                        />
                                        <span className="text-slate-500">—</span>
                                        <input
                                            type="time"
                                            value={h.to}
                                            onChange={(e) => updateHour(day.key, 'to', e.target.value)}
                                            className="px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-xs outline-none"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-500">مغلق</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
