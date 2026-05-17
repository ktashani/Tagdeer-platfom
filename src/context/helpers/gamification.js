// --- Gamification Helpers ---
export const calculateTier = (points, lang, vipThresholds) => {
    const thresholds = vipThresholds || { guest: 0, bronze: 20, silver: 1000, gold: 5000, vip: 20000 };

    if (!points || points < thresholds.guest) return { name: lang === 'ar' ? 'ضيف' : 'Guest', emoji: '👤', color: 'text-slate-600', max: thresholds.guest };
    if (points < thresholds.bronze) return { name: lang === 'ar' ? 'برونزي' : 'Bronze', emoji: '🥉', color: 'text-amber-700', max: thresholds.bronze };
    if (points < thresholds.silver) return { name: lang === 'ar' ? 'فضي' : 'Silver', emoji: '🥈', color: 'text-slate-600', max: thresholds.silver };
    if (points < thresholds.gold) return { name: lang === 'ar' ? 'ذهبي' : 'Gold', emoji: '🥇', color: 'text-yellow-700', max: thresholds.gold };
    return { name: 'VIP', emoji: '💎', color: 'text-indigo-700', max: Infinity };
};

export const getRandomCommunityTitle = (lang) => {
    const titles = lang === 'ar' ? [
        'كريم التقدير', 'ولد البلاد', 'بنت البلاد', 'البوصلة', 'الميزان',
        'مدمر البرجر', 'راعي المزاج', 'قناص الشاورما', 'الذوّاق',
        'وحش السوق', 'صياد اللقطات', 'مفتش الجودة',
        'من الأخير', 'كاشف المستور', 'فزّاع المجتمع'
    ] : [
        'The Generous', 'Local Expert', 'The Compass', 'The Fair Judge',
        'Burger Smasher', 'The Vibe Checker', 'Shawarma Sniper', 'Fine Diner',
        'Shopping Monster', 'Deal Hunter', 'Quality Inspector',
        'The Bottom Liner', 'The Myth Buster', 'The Volunteer'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
};
