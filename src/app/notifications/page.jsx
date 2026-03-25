'use client';

import React, { useState, useEffect } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Bell, CheckCheck, Filter, Loader2, ArrowLeft, Trash2, AlertTriangle, Gift, CreditCard, ShieldCheck, Store } from 'lucide-react';

const TYPE_CONFIG = {
    claim_approved: { icon: Store, color: 'bg-emerald-100 text-emerald-600', label: 'Claim' },
    claim_rejected: { icon: AlertTriangle, color: 'bg-red-100 text-red-600', label: 'Claim' },
    payment_approved: { icon: CreditCard, color: 'bg-blue-100 text-blue-600', label: 'Payment' },
    payment_rejected: { icon: CreditCard, color: 'bg-red-100 text-red-600', label: 'Payment' },
    subscription_expiring: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', label: 'Subscription' },
    subscription_expired: { icon: AlertTriangle, color: 'bg-red-100 text-red-600', label: 'Subscription' },
    coupon_granted: { icon: Gift, color: 'bg-emerald-100 text-emerald-600', label: 'Reward' },
    verification: { icon: ShieldCheck, color: 'bg-blue-100 text-blue-600', label: 'Verification' },
};

const DEFAULT_CONFIG = { icon: Bell, color: 'bg-slate-100 text-slate-600', label: 'Notification' };

export default function NotificationsPage() {
    const { user, lang, isRTL } = useTagdeer();
    const router = useRouter();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, read

    useEffect(() => {
        if (!user?.id) { setLoading(false); return; }

        const fetchNotifications = async () => {
            let query = supabase
                .from('notifications')
                .select('id, type, title, body, is_read, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            const { data, error } = await query;
            if (!error && data) setNotifications(data);
            setLoading(false);
        };

        fetchNotifications();
    }, [user]);

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.is_read;
        if (filter === 'read') return n.is_read;
        return true;
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllRead = async () => {
        if (!user?.id) return;
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const deleteNotification = async (id) => {
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const formatTime = (dateStr) => {
        const now = new Date();
        const d = new Date(dateStr);
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return lang === 'ar' ? 'الآن' : 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}${lang === 'ar' ? ' د' : 'm'}`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}${lang === 'ar' ? ' س' : 'h'}`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}${lang === 'ar' ? ' ي' : 'd'}`;
        return d.toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en');
    };

    if (!user) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <p className="text-slate-500">{lang === 'ar' ? 'سجّل دخول لمشاهدة الإشعارات' : 'Sign in to view notifications'}</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ArrowLeft className={`w-5 h-5 text-slate-600 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Bell className="w-6 h-6" />
                            {lang === 'ar' ? 'الإشعارات' : 'Notifications'}
                            {unreadCount > 0 && (
                                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
                            )}
                        </h1>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                        <CheckCheck className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
                {[
                    { key: 'all', label: lang === 'ar' ? 'الكل' : 'All', count: notifications.length },
                    { key: 'unread', label: lang === 'ar' ? 'غير مقروء' : 'Unread', count: unreadCount },
                    { key: 'read', label: lang === 'ar' ? 'مقروء' : 'Read', count: notifications.length - unreadCount },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                            filter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Notification List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-16">
                    <div className="bg-slate-100 w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                        <Bell className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">{lang === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredNotifications.map(n => {
                        const config = TYPE_CONFIG[n.type] || DEFAULT_CONFIG;
                        const Icon = config.icon;

                        return (
                            <div
                                key={n.id}
                                onClick={() => !n.is_read && markAsRead(n.id)}
                                className={`relative bg-white rounded-xl border p-4 transition-all cursor-pointer group ${
                                    n.is_read ? 'border-slate-200 opacity-70' : 'border-blue-200 shadow-sm hover:shadow-md'
                                }`}
                            >
                                {!n.is_read && (
                                    <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-blue-600 rounded-full" />
                                )}
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-bold text-sm text-slate-800 truncate">{n.title}</span>
                                            <span className="text-[10px] text-slate-400 shrink-0">{formatTime(n.created_at)}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 leading-relaxed">{n.body}</p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
