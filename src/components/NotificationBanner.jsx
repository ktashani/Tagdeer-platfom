'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Notification type → visual config mapping
 */
const NOTIFICATION_STYLES = {
  subscription_expiring: {
    icon: '⚠️',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    label: 'تنبيه اشتراك',
  },
  subscription_expired: {
    icon: '🔴',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    label: 'اشتراك منتهي',
  },
  claim_approved: {
    icon: '✅',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'تمت الموافقة',
  },
  claim_rejected: {
    icon: '❌',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    label: 'تم الرفض',
  },
  payment_received: {
    icon: '💰',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'دفع مستلم',
  },
  payment_overdue: {
    icon: '💳',
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-700',
    label: 'دفع متأخر',
  },
  system_announcement: {
    icon: '📢',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
    label: 'إعلان',
  },
};

const DEFAULT_STYLE = {
  icon: '🔔',
  bg: 'bg-neutral-50 border-neutral-200',
  text: 'text-neutral-800',
  badge: 'bg-neutral-100 text-neutral-700',
  label: 'إشعار',
};

/**
 * Time ago formatter (Arabic)
 */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-LY');
}

/**
 * Single notification item
 */
function NotificationItem({ notification, onDismiss }) {
  const style = NOTIFICATION_STYLES[notification.type] || DEFAULT_STYLE;

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border transition-all duration-300
        ${style.bg} ${!notification.is_read ? 'shadow-sm' : 'opacity-75'}
      `}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
          <span className="text-xs text-neutral-400">{timeAgo(notification.created_at)}</span>
        </div>
        <p className={`text-sm font-semibold ${style.text}`}>{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
        aria-label="dismiss"
      >
        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * NotificationBanner — renders as a top-of-page dismissible section
 * or as a dropdown panel attached to the nav bell icon.
 */
export default function NotificationBanner({ variant = 'banner' }) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications({
    unreadOnly: variant === 'banner',
    limit: variant === 'banner' ? 3 : 20,
  });
  const [isOpen, setIsOpen] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  // ─── Banner variant: top-of-page alerts ───
  if (variant === 'banner') {
    if (loading || notifications.length === 0 || !isOpen) return null;

    return (
      <div className="space-y-2 mb-6 animate-in slide-in-from-top duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-600 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            إشعارات جديدة ({unreadCount})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              قراءة الكل
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              إخفاء
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onDismiss={markRead} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Bell variant: nav icon + dropdown ───
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        aria-label="notifications"
        id="notification-bell"
      >
        <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-in zoom-in duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          {/* Dropdown panel */}
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-white rounded-2xl shadow-xl border border-neutral-200 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900">الإشعارات</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  قراءة الكل
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-[380px] p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-2">🔔</div>
                  <p className="text-sm text-neutral-500">لا توجد إشعارات</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onDismiss={markRead} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
