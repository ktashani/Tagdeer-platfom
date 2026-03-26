import React from 'react';
import { BadgeCheck, Menu, X } from 'lucide-react';
import { useTagdeer } from '../../context/TagdeerContext';

export function Navigation({
  lang,
  setLang,
  t,
  isRTL,
  currentPage,
  navigateTo,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setShowVerifySoonModal
}) {
  const { user, setShowLoginModal } = useTagdeer();

  const navItems = [
    { key: 'home', label: t('home') },
    { key: 'discover', label: t('discover') },
    { key: 'add', label: t('add_business') },
    { key: 'about', label: t('about') },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center cursor-pointer gap-2" onClick={() => navigateTo('home')}>
            <BadgeCheck className="h-10 w-10 text-green-600" />
            <div>
              <span className="font-bold text-2xl text-blue-800 tracking-tight">Tagdeer</span>
              <span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold">تـقــديـــر • Libya</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => navigateTo(item.key)}
                className={`text-base font-medium ${currentPage === item.key ? 'text-green-600' : 'text-slate-600 hover:text-blue-600'}`}
              >
                {item.label}
              </button>
            ))}

            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm transition-colors"
            >
              {lang === 'en' ? 'AR' : 'EN'}
            </button>

            <div className={`px-4 ${isRTL ? 'border-r' : 'border-l'} border-slate-200`}>
              {user ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigateTo('profile')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm tracking-wide"
                  >
                    {t('profile_nav') || (lang === 'ar' ? 'حسابي' : 'Profile')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm tracking-wide"
                >
                  {t('login_nav') || 'Login / Signup'}
                </button>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-sm"
            >
              {lang === 'en' ? 'AR' : 'EN'}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 hover:text-blue-600"
            >
              {isMobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-2 pt-2 pb-4 space-y-1 shadow-lg">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => navigateTo(item.key)}
              className="block w-full text-start px-3 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
          {user ? (
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => { setIsMobileMenuOpen(false); navigateTo('profile'); }}
                className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-3 rounded-md font-bold transition-colors"
              >
                {t('profile_nav') || (lang === 'ar' ? 'حسابي' : 'Profile')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setIsMobileMenuOpen(false); setShowLoginModal(true); }}
              className="block w-full text-center mt-4 bg-blue-700 hover:bg-blue-800 text-white px-3 py-3 rounded-md font-bold transition-colors"
            >
              {t('login_nav') || 'Login / Signup'}
            </button>
          )}
        </div>
      )}
    </nav >
  );
}
