'use client';

import React, { useState } from 'react';
import { useTagdeer } from '../context/TagdeerContext';
import { Hero } from '../components/Hero/Hero';
import { useRouter } from 'next/navigation';

export default function HomePage() {
    const { t, lang, isRTL, businesses, setShowPreRegModal } = useTagdeer();
    const [searchQuery, setSearchQuery] = useState('');
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const router = useRouter();

    const navigateTo = (page) => {
        if (page === 'home') router.push('/');
        else router.push(`/${page}`);
    };

    const toggleFaq = (index) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

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
    );
}
