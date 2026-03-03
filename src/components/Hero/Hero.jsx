import React from 'react';
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Facebook,
  Globe,
  AlertCircle,
  CheckCircle2,
  Menu,
  X,
  Twitter,
  Instagram,
  Mail,
  PlusCircle,
  Share2,
  MessageSquare,
  ShieldAlert,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  Store,
  HelpCircle,
  Sparkles,
  BadgeCheck,
  Gift,
  Award,
  Zap,
  BookOpen,
  Users,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';

export function Hero({
  t,
  lang,
  isRTL,
  searchQuery,
  setSearchQuery,
  navigateTo,
  topBusiness,
  setShowPreRegModal,
  faqItems,
  openFaqIndex,
  toggleFaq
}) {
  return (
    <div>
      {/* Hero Section */}
      <div className="relative bg-slate-900 overflow-hidden pt-24 pb-32">
        <div className={`absolute top-[-20%] ${isRTL ? 'right-[-10%]' : 'left-[-10%]'} w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[100px] opacity-60`}></div>
        <div className={`absolute bottom-[-20%] ${isRTL ? 'left-[-10%]' : 'right-[-10%]'} w-[500px] h-[500px] bg-green-500/20 rounded-full blur-[100px] opacity-60`}></div>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">

          <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/10 border border-white/20 text-green-300 text-sm font-semibold tracking-wider mb-8 backdrop-blur-md shadow-lg">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            {t('hero_badge')}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6 tracking-tight drop-shadow-md">
            {t('hero_title')}
          </h1>

          <p className="text-lg md:text-xl text-blue-100/90 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
            {t('hero_subtitle')}
          </p>

          {/* Search Engine */}
          <div className="max-w-2xl mx-auto bg-white p-2 md:p-3 rounded-2xl shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] flex flex-col md:flex-row items-center gap-2 mb-8 transition-transform hover:scale-[1.02] duration-300">
            <div className={`flex-1 flex items-center w-full px-4 py-2 ${isRTL ? 'border-l' : 'border-r'} border-slate-100`}>
              <Search className="h-6 w-6 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={t('hero_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigateTo(searchQuery ? `discover?q=${encodeURIComponent(searchQuery)}` : 'discover');
                  }
                }}
                className="w-full bg-transparent border-none outline-none text-lg text-slate-800 px-4 placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => navigateTo(searchQuery ? `discover?q=${encodeURIComponent(searchQuery)}` : 'discover')}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors shrink-0 whitespace-nowrap"
            >
              {t('hero_search_btn')}
            </button>
          </div>

          {/* Floating Tags */}
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
            <button onClick={() => navigateTo('add')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full border border-white/20 backdrop-blur-md transition-colors">
              <PlusCircle className="h-4 w-4" /> {t('hero_tag_add')}
            </button>
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-blue-500/20 text-green-200 px-5 py-2.5 rounded-full border border-green-500/30 backdrop-blur-md cursor-default">
              <Gift className="h-4 w-4 text-yellow-400" /> {t('hero_tag_earn')}
            </div>
            <div className="flex items-center gap-2 bg-white/5 text-blue-200 px-5 py-2.5 rounded-full border border-white/10 backdrop-blur-md cursor-default">
              <Zap className="h-4 w-4 text-blue-400" /> {t('hero_tag_trust')}
            </div>
          </div>

        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {topBusiness && (
            <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
              <div className={`absolute -top-10 ${isRTL ? '-left-10' : '-right-10'} text-blue-100 opacity-50`}><ThumbsUp className="h-40 w-40" /></div>
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-blue-800 mb-1">{t('top_biz_title')}</h3>
                <p className="text-sm text-slate-500 mb-6">{t('top_biz_subtitle')}</p>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-2xl font-bold text-slate-800">{topBusiness.name}</h4>
                      <span className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin className="h-4 w-4" /> {t(topBusiness.region)}</span>
                    </div>
                    <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-lg text-lg">
                      {topBusiness.recommends + topBusiness.complains} Votes
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => navigateTo('discover')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors">
                      {lang === 'ar' ? 'عرض الملف' : 'View Profile'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-8 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden text-white">
            <div className={`absolute -bottom-10 ${isRTL ? '-left-10' : '-right-10'} text-white/5`}><ShieldAlert className="h-48 w-48" /></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 border border-green-500/30">
                <BadgeCheck className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('promo_shield_title')}</h3>
              <p className="text-blue-100 leading-relaxed mb-6">{t('promo_shield_desc')}</p>
              <button
                onClick={() => setShowPreRegModal(true)}
                className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/30"
              >
                {lang === 'ar' ? 'التسجيل المسبق للشركات' : 'Pre-Register Business'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-blue-900 mb-4">{t('how_it_works')}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('how_subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-700"><HeartHandshake className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'مساعدة الآخرين' : 'Help Others'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'ملاحظاتك ترشد الآخرين في مجتمعك لاتخاذ خيارات أفضل ودعم الشركات التي تستحق ذلك.' : 'Your feedback guides others in your community to make better choices and support deserving businesses.'}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-700"><ThumbsUp className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'تحسين مستوى الخدمة' : 'Elevate Service Quality'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'التصويت الحقيقي يعطي أصحاب الأعمال رؤية واضحة حول أدائهم، مما يدفعهم لتحسين خدماتهم.' : 'Authentic votes give business owners a clear view of their performance, pushing them to improve their services.'}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 ${isRTL ? 'left-0 rounded-br-full' : 'right-0 rounded-bl-full'} w-24 h-24 bg-green-500 opacity-10 group-hover:scale-110 transition-transform`}></div>
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6 text-green-700"><BadgeCheck className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'بيئة محمية وآمنة' : 'Protected & Safe Environment'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'من خلال اشتراط التحقق من الهوية والفواتير في الشركات المحمية، نضمن خلو المجتمع من التقييمات الوهمية.' : 'By requiring verification and receipts for shielded companies, we ensure the community is free from fake reviews.'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-t border-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 relative">
            <div className="absolute top-0 left-1/4 animate-bounce hidden md:block opacity-50"><Sparkles className="h-8 w-8 text-yellow-400" /></div>
            <div className="absolute top-10 right-1/4 animate-pulse hidden md:block opacity-50"><HelpCircle className="h-10 w-10 text-indigo-300" /></div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-900 mb-4 tracking-tight">
              {t('faq_title')}
            </h2>
            <p className="text-lg text-indigo-600/80 max-w-2xl mx-auto font-medium">
              {t('faq_subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200'}`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex justify-between items-center p-6 text-left focus:outline-none"
                  >
                    <h3 className={`text-lg font-bold pr-4 ${isOpen ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {item.q}
                    </h3>
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </button>

                  <div
                    className={`px-6 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-60 pb-6 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                  >
                    <p className="text-slate-600 leading-relaxed border-t border-indigo-50 pt-4">
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
