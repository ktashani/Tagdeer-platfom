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

    </div>
  );
}
