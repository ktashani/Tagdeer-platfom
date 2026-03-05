'use client';

import React, { useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AddBusinessRoute() {
    const {
        t, lang, supabase, businesses, setBusinesses,
        showToast, categories = [], regions = []
    } = useTagdeer();

    const [newBizInput, setNewBizInput] = useState('');
    const [newBizRegion, setNewBizRegion] = useState('');
    const [newBizCategory, setNewBizCategory] = useState('');

    React.useEffect(() => {
        if (regions.length > 0 && !newBizRegion) setNewBizRegion(regions[0]);
        if (categories.length > 0 && !newBizCategory) setNewBizCategory(categories[0]);
    }, [regions, categories, newBizRegion, newBizCategory]);

    const router = useRouter();

    const handleSubmit = async () => {
        if (!newBizInput) return showToast(lang === 'ar' ? "يرجى إدخال اسم" : "Please enter a name");
        if (supabase) {
            const { data, error } = await supabase.from('businesses').insert([{ name: newBizInput, region: newBizRegion, category: newBizCategory }]).select();
            if (data) {
                setBusinesses([...businesses, { ...data[0], recommends: 0, complains: 0, logs: [] }]);
                showToast("Success");
                router.push('/discover');
            }
        } else {
            // Mock for missing supabase
            setBusinesses([...businesses, { id: Date.now(), name: newBizInput, region: newBizRegion, category: newBizCategory, recommends: 0, complains: 0, isShielded: false, source: "Manual", logs: [] }]);
            showToast("Success (Mocked)");
            router.push('/discover');
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
                            {regions.map(r => <option key={r} value={r}>{t(r)}</option>)}
                        </select>
                        <select value={newBizCategory} onChange={(e) => setNewBizCategory(e.target.value)} className="w-full px-4 py-4 rounded-xl border border-slate-300">
                            {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                        </select>
                    </div>
                    <button onClick={handleSubmit} className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold">{t('generate_profile')}</button>
                </div>
            </div>
        </div>
    );
}
