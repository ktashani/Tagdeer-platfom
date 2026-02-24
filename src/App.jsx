'use client';
import React, { useState, useEffect } from 'react';
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Facebook,
  Globe,
  Menu,
  X,
  Twitter,
  Share2,
  MessageSquare,
  ShieldAlert,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  HelpCircle,
  Sparkles,
  BadgeCheck,
  Gift,
  Zap,
  BookOpen,
  Users,
  TrendingUp
} from 'lucide-react';
import { translations } from './i18n/translations';
import { useSupabase } from './hooks/useSupabase';
import { Navigation } from './components/Navigation/Navigation';
import { Hero } from './components/Hero/Hero';
import { VoteModal } from './components/Modals/VoteModal';
import { PreRegModal } from './components/Modals/PreRegModal';
import { LimitModal } from './components/Modals/LimitModal';
import { VerifySoonModal } from './components/Modals/VerifySoonModal';
import { Toast } from './components/Toast';
import { getDeviceFingerprint } from './lib/fingerprint';
import { containsBadWords } from './lib/contentFilter';
import './App.css';

const INITIAL_BUSINESSES = [
  { id: 1, name: "Al-Madina Tech", region: "Tripoli", category: "Electronics", recommends: 145, complains: 12, isShielded: true, source: "Google", logs: [] },
  {
    id: 2, name: "Benghazi Builders Co.", region: "Benghazi", category: "Construction", recommends: 89, complains: 45, isShielded: false, source: "Facebook",
    logs: [{ id: 101, type: 'recommend', text: 'Fast and reliable building materials. Great service.', date: '2026-02-18' }]
  },
  { id: 3, name: "Tripoli Central Clinic", region: "Tripoli", category: "Healthcare", recommends: 320, complains: 5, isShielded: true, source: "Google", logs: [] },
  {
    id: 4, name: "Omar's Auto Repair", region: "Benghazi", category: "Automotive", recommends: 34, complains: 8, isShielded: false, source: "Manual",
    logs: [{ id: 102, type: 'complain', text: 'Overcharged me for a simple oil change. Needs improvement.', date: '2026-02-20' }]
  },
  { id: 5, name: "Sahara Logistics", region: "Tripoli", category: "Services", recommends: 210, complains: 55, isShielded: true, source: "Google", logs: [] },
];

export const CATEGORIES = [
  "All", "Supermarket", "Pharmacy", "Café & Restaurants", "Bakery",
  "Healthcare", "Electronics", "Tech & Telecommunication", "Construction",
  "Home Maintenance", "Automotive", "Beauty & Salon", "Real Estate",
  "Education", "Travel", "Fashion & Retail", "Services", "Food & Beverage", "Delivery & Shipping"
];

export const REGIONS = ["All", "Tripoli", "Benghazi"];

export default function App() {
  const [lang, setLang] = useState('ar');
  const t = (key) => translations[lang][key] || key;
  const isRTL = lang === 'ar';

  const [currentPage, setCurrentPage] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [businesses, setBusinesses] = useState(INITIAL_BUSINESSES);

  const { supabase } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [anonInteractions, setAnonInteractions] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [voteModal, setVoteModal] = useState({ isOpen: false, businessId: null, type: null });
  const [voteReason, setVoteReason] = useState('');

  const [showVerifySoonModal, setShowVerifySoonModal] = useState(false);
  const [showPreRegModal, setShowPreRegModal] = useState(false);
  const [preRegData, setPreRegData] = useState({ name: '', phone: '', bizName: '' });

  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [newBizInput, setNewBizInput] = useState('');
  const [newBizRegion, setNewBizRegion] = useState('Tripoli');
  const [newBizCategory, setNewBizCategory] = useState('Electronics');
  const [expandedLogs, setExpandedLogs] = useState({});

  const toggleLogs = (id) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*, interactions(*)');

        if (error) {
          console.warn('Supabase fetch failed, falling back to mock data.', error);
          return;
        }
        if (data) {
          const formattedData = data.map(b => {
            const rawInteractions = b.interactions || [];
            const derivedRecommends = rawInteractions.filter(i => i.interaction_type === 'recommend').length;
            const derivedComplains = rawInteractions.filter(i => i.interaction_type === 'complain').length;

            return {
              id: b.id,
              name: b.name,
              region: b.region,
              category: b.category,
              recommends: derivedRecommends,
              complains: derivedComplains,
              isShielded: b.is_shielded,
              source: b.source,
              external_url: b.external_url,
              logs: rawInteractions
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(log => ({
                  id: log.id,
                  type: log.interaction_type,
                  text: log.reason_text || (log.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                  date: new Date(log.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US')
                }))
            };
          });
          setBusinesses(formattedData);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBusinesses();
  }, [supabase, lang]);

  useEffect(() => {
    const storedInteractions = localStorage.getItem('trust_ledger_interactions');
    if (storedInteractions) setAnonInteractions(parseInt(storedInteractions));
  }, []);

  const openVoteModal = async (businessId, type, isShielded) => {
    if (type === 'complain' && isShielded) {
      showToast(t('shielded_warning'));
      return;
    }

    // Check Fingerprint Limit Database-side
    const fingerprint = getDeviceFingerprint();
    if (supabase && fingerprint.startsWith('anon-')) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      try {
        const { count, error } = await supabase
          .from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('fingerprint', fingerprint)
          .gte('created_at', twentyFourHoursAgo);

        if (!error && count >= 3) {
          setShowLimitModal(true);
          return;
        }
      } catch (e) {
        console.error("Error checking limits:", e);
      }
    } else if (anonInteractions >= 3) {
      // Fallback to local storage count if offline
      setShowLimitModal(true);
      return;
    }

    setVoteModal({ isOpen: true, businessId, type });
    setVoteReason('');
  };

  const submitVote = async () => {
    const { businessId, type } = voteModal;
    const fingerprint = getDeviceFingerprint();
    let logStatus = 'approved';

    if (containsBadWords(voteReason)) {
      logStatus = 'flagged';
      showToast(lang === 'ar' ? "تم استلام ملاحظتك وهي قيد المراجعة لمخالفتها الشروط." : "Log received. It is pending review due to community guidelines.");
      // Still insert it, but it's flagged and won't count towards the score depending on the SQL view/logic
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('interactions').insert([{
          business_id: businessId,
          interaction_type: type,
          reason_text: voteReason,
          fingerprint: fingerprint,
          status: logStatus
        }]);

        if (error) {
          console.error("Supabase insert error:", error);
          showToast(lang === 'ar' ? "حدث خطأ: " + error.message : "Error: " + error.message);
          return;
        }
      } catch (err) {
        console.error("Supabase insert exception:", err);
        showToast("Connection failed.");
        return;
      }
    }

    const newCount = anonInteractions + 1;
    setAnonInteractions(newCount);
    localStorage.setItem('trust_ledger_interactions', newCount.toString());

    // Only update local UI if not flagged, so user knows it's pending vs approved
    if (logStatus === 'approved') {
      setBusinesses(businesses.map(b => {
        if (b.id === businessId) {
          const newLog = {
            id: Date.now(),
            type: type,
            text: voteReason || (type === 'recommend' ? 'User recommended' : 'User complained'),
            date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US')
          };
          return {
            ...b,
            recommends: type === 'recommend' ? b.recommends + 1 : b.recommends,
            complains: type === 'complain' ? b.complains + 1 : b.complains,
            logs: [newLog, ...b.logs]
          };
        }
        return b;
      }));
    }

    setVoteModal({ isOpen: false, businessId: null, type: null });
    showToast(`Successfully logged. (${3 - newCount} anonymous logs remaining)`);
  };

  const submitPreRegistration = async () => {
    if (!preRegData.name || !preRegData.phone || !preRegData.bizName) {
      showToast(t('prereg_fill_all'));
      return;
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('pre_registrations').insert([
          {
            owner_name: preRegData.name,
            phone_number: preRegData.phone,
            business_name: preRegData.bizName
          }
        ]);

        if (error) {
          console.error("Pre-registration error:", error);
          showToast(t('prereg_error') + ": " + error.message);
          return;
        }

        showToast(t('prereg_success'));
        setShowPreRegModal(false);
        setPreRegData({ name: '', phone: '', bizName: '' });
      } catch (err) {
        console.error(err);
        showToast(t('prereg_error'));
      }
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const shareToFacebook = (title, text) => {
    const url = encodeURIComponent(window.location.href);
    const quote = encodeURIComponent(`${title} - ${text}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
  };

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === 'All' || b.region === selectedRegion;
    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
    return matchesSearch && matchesRegion && matchesCategory;
  });

  const topBusiness = [...businesses]
    .filter(b => !b.isShielded)
    .sort((a, b) => (b.recommends + b.complains) - (a.recommends + a.complains))[0];

  const faqItems = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') }
  ];

  return (
    <div className={`min-h-screen flex flex-col font-sans bg-slate-50 text-slate-800 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      <Navigation
        lang={lang}
        setLang={setLang}
        t={t}
        isRTL={isRTL}
        currentPage={currentPage}
        navigateTo={navigateTo}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setShowVerifySoonModal={setShowVerifySoonModal}
      />

      <main className="flex-grow">

        {currentPage === 'home' && (
          <Hero
            t={t}
            lang={lang}
            isRTL={isRTL}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            navigateTo={navigateTo}
            topBusiness={topBusiness}
            setShowPreRegModal={setShowPreRegModal}
            faqItems={faqItems}
            openFaqIndex={openFaqIndex}
            toggleFaq={toggleFaq}
          />
        )}

        {currentPage === 'discover' && (
          <DiscoverPage
            t={t}
            lang={lang}
            isRTL={isRTL}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            filteredBusinesses={filteredBusinesses}
            openVoteModal={openVoteModal}
            shareToFacebook={shareToFacebook}
            expandedLogs={expandedLogs}
            toggleLogs={toggleLogs}
          />
        )}

        {currentPage === 'add' && (
          <AddBusinessPage
            t={t}
            lang={lang}
            newBizInput={newBizInput}
            setNewBizInput={setNewBizInput}
            newBizRegion={newBizRegion}
            setNewBizRegion={setNewBizRegion}
            newBizCategory={newBizCategory}
            setNewBizCategory={setNewBizCategory}
            supabase={supabase}
            businesses={businesses}
            setBusinesses={setBusinesses}
            showToast={showToast}
            navigateTo={navigateTo}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            t={t}
            lang={lang}
            navigateTo={navigateTo}
            setShowPreRegModal={setShowPreRegModal}
          />
        )}
      </main>

      <Footer t={t} />

      <VoteModal
        isOpen={voteModal.isOpen}
        onClose={() => setVoteModal({ isOpen: false, businessId: null, type: null })}
        voteReason={voteReason}
        setVoteReason={setVoteReason}
        onSubmit={submitVote}
        t={t}
        type={voteModal.type}
      />

      <PreRegModal
        isOpen={showPreRegModal}
        onClose={() => setShowPreRegModal(false)}
        preRegData={preRegData}
        setPreRegData={setPreRegData}
        onSubmit={submitPreRegistration}
        t={t}
      />

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        t={t}
      />

      <VerifySoonModal
        isOpen={showVerifySoonModal}
        onClose={() => setShowVerifySoonModal(false)}
        t={t}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </div>
  );
}

function DiscoverPage({ t, lang, isRTL, searchQuery, setSearchQuery, selectedRegion, setSelectedRegion, selectedCategory, setSelectedCategory, filteredBusinesses, openVoteModal, shareToFacebook, expandedLogs, toggleLogs }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">{t('discover_title')}</h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5`} />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
            {REGIONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
          </select>
          <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {filteredBusinesses.map(business => (
          <BusinessCard
            key={business.id}
            business={business}
            t={t}
            lang={lang}
            isRTL={isRTL}
            openVoteModal={openVoteModal}
            shareToFacebook={shareToFacebook}
            expandedLogs={expandedLogs}
            toggleLogs={toggleLogs}
          />
        ))}
      </div>
    </div>
  );
}

function BusinessCard({ business, t, lang, isRTL, openVoteModal, shareToFacebook, expandedLogs, toggleLogs }) {
  const totalLogs = business.recommends + business.complains;
  const gaderIndex = totalLogs === 0 ? 0 : Math.round((business.recommends / totalLogs) * 100);
  const avatarLetter = business.name ? business.name.charAt(0).toUpperCase() : '?';

  const getGradient = (category) => {
    const gradients = {
      'Electronics': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'Tech & Telecommunication': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'Healthcare': 'linear-gradient(135deg, #10b981, #047857)',
      'Pharmacy': 'linear-gradient(135deg, #10b981, #047857)',
      'Café & Restaurants': 'linear-gradient(135deg, #f59e0b, #b45309)',
      'Bakery': 'linear-gradient(135deg, #f59e0b, #b45309)',
      'Beauty & Salon': 'linear-gradient(135deg, #ec4899, #be185d)',
    };
    return gradients[category] || 'linear-gradient(135deg, #64748b, #334155)';
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-bold text-white shadow-inner"
          style={{ background: getGradient(business.category) }}
        >
          {avatarLetter}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-bold text-slate-800 break-words line-clamp-2 leading-tight">{business.name}</h3>
            {business.external_url && (
              <a href={business.external_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-full shrink-0">
                <Facebook className="h-5 w-5" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center text-sm text-slate-500 gap-2 mt-2">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400 shrink-0" /> {t(business.region)}</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded-md truncate">{t(business.category)}</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button onClick={() => shareToFacebook(business.name, `Tagdeer Gader Index: ${gaderIndex}%`)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <Share2 className="h-5 w-5" />
          </button>
          {business.isShielded && (
            <div className="bg-blue-50 p-2 rounded-full border border-blue-100">
              <BadgeCheck className="h-5 w-5 text-blue-600" />
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 hover:border-blue-200 transition-colors cursor-help">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${gaderIndex >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-slate-700 font-bold text-lg leading-tight">{t('gader_index')}</span>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('migdar')}</span>
            </div>
          </div>
          <span className={`text-2xl font-black tracking-tight ${gaderIndex > 50 ? 'text-green-600' : 'text-red-500'}`}>
            {gaderIndex}%
          </span>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex mb-3 shadow-inner">
          <div className="bg-gradient-to-r from-green-400 to-green-500 h-3 transition-all duration-1000 ease-out" style={{ width: `${gaderIndex}%` }}></div>
          <div className="bg-gradient-to-r from-red-400 to-red-500 h-3 transition-all duration-1000 ease-out" style={{ width: `${100 - gaderIndex}%` }}></div>
        </div>

        <div className="flex justify-between text-xs font-bold px-1">
          <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded">
            <ThumbsUp className="w-3 h-3" />
            {business.recommends} {t('recommend')}
          </div>
          <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-0.5 rounded">
            {business.complains} {t('complain')}
            <ThumbsDown className="w-3 h-3" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={() => openVoteModal(business.id, 'recommend', false)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
          <ThumbsUp className="h-5 w-5" /> {t('recommend')}
        </button>
        <button onClick={() => openVoteModal(business.id, 'complain', business.isShielded)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
          <ThumbsDown className="h-5 w-5" /> {t('complain')}
        </button>
      </div>

      <div className="mt-auto border-t border-slate-100 pt-4">
        <button onClick={() => toggleLogs(business.id)} className="w-full flex justify-between items-center font-semibold text-slate-700 mb-3 hover:text-blue-600">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('logs')}
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{business.logs.length}</span>
          </div>
          {expandedLogs[business.id] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedLogs[business.id] && (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {business.logs.map(log => (
              <div key={log.id} className="bg-slate-50 p-3 rounded-lg text-sm flex justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {log.type === 'recommend' ? <ThumbsUp className="h-4 w-4 text-green-500" /> : <ThumbsDown className="h-4 w-4 text-red-500" />}
                    <span className="text-slate-400 text-xs">{log.date}</span>
                  </div>
                  <p className="text-slate-700">{log.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddBusinessPage({ t, lang, newBizInput, setNewBizInput, newBizRegion, setNewBizRegion, newBizCategory, setNewBizCategory, supabase, businesses, setBusinesses, showToast, navigateTo }) {
  const handleSubmit = async () => {
    if (!newBizInput) return showToast(lang === 'ar' ? "يرجى إدخال اسم" : "Please enter a name");
    if (supabase) {
      const { data, error } = await supabase.from('businesses').insert([{ name: newBizInput, region: newBizRegion, category: newBizCategory }]).select();
      if (data) {
        setBusinesses([...businesses, { ...data[0], recommends: 0, complains: 0, logs: [] }]);
        showToast("Success");
        navigateTo('discover');
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Globe className="h-8 w-8 text-blue-700" />
        </div>
        <h1 className="text-3xl font-bold text-blue-900 mb-4">{t('add_page_title')}</h1>
        <p className="text-slate-600 mb-10">{t('add_page_desc')}</p>

        <div className="space-y-6">
          <input
            type="text"
            value={newBizInput}
            onChange={(e) => setNewBizInput(e.target.value)}
            placeholder={t('add_page_input_placeholder')}
            className="w-full px-6 py-4 rounded-xl border border-slate-300 outline-none bg-slate-50"
          />
          <div className="grid grid-cols-2 gap-4">
            <select value={newBizRegion} onChange={(e) => setNewBizRegion(e.target.value)} className="w-full px-4 py-4 rounded-xl border border-slate-300">
              {REGIONS.filter(r => r !== 'All').map(r => <option key={r} value={r}>{t(r)}</option>)}
            </select>
            <select value={newBizCategory} onChange={(e) => setNewBizCategory(e.target.value)} className="w-full px-4 py-4 rounded-xl border border-slate-300">
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{t(c)}</option>)}
            </select>
          </div>
          <button onClick={handleSubmit} className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold">{t('generate_profile')}</button>
        </div>
      </div>
    </div>
  );
}

function AboutPage({ t, lang, navigateTo, setShowPreRegModal }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-bold tracking-wider mb-6">
          <BadgeCheck className="h-4 w-4" /> {lang === 'ar' ? 'أعطيهم تقديرك، واكسب قَدْرك' : 'Give your Tagdeer, earn your Gader'}
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">{t('about_title')}</h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          {t('about_intro_p1')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-20">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <HeartHandshake className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_concept_title')}</h3>
          <p className="text-slate-600">{t('about_concept_desc')}</p>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_sat_title')}</h3>
          <p className="text-slate-600">{t('about_sat_desc')}</p>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
            <BookOpen className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_dict_title')}</h3>
          <p className="text-slate-600 italic">{t('about_dict_desc')}</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[40px] p-8 md:p-16 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-blue-300" />
            <h3 className="text-2xl md:text-3xl font-bold">{lang === 'ar' ? 'رؤيتنا للمستقبل' : 'Our Vision for the Future'}</h3>
          </div>
          <p className="text-xl md:text-2xl text-blue-100 leading-relaxed font-medium">
            {t('about_p2')}
          </p>
          <div className="mt-10 flex gap-4">
            <button onClick={() => navigateTo('discover')} className="bg-white text-blue-900 px-8 py-3.5 rounded-2xl font-bold hover:bg-blue-50 transition-colors">
              {t('find_biz')}
            </button>
            <button onClick={() => setShowPreRegModal(true)} className="bg-blue-600/30 border border-white/20 backdrop-blur-md text-white px-8 py-3.5 rounded-2xl font-bold">
              {lang === 'ar' ? 'سجل عملك' : 'Register Business'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer({ t }) {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-8 w-8 text-green-500" />
          <span className="font-bold text-xl text-white">Tagdeer</span>
        </div>
        <div className="flex gap-4 items-center">
          <a href="#" className="hover:text-white"><Facebook className="h-5 w-5" /></a>
          <a href="#" className="hover:text-white"><Twitter className="h-5 w-5" /></a>
        </div>
        <p className="text-sm">© 2026 Tagdeer Libya.</p>
      </div>
    </footer>
  );
}
