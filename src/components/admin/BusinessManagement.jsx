'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Admin Business Management — view, edit, delete businesses.
 * Supports search, category filter, claimed/unclaimed filter.
 */
export default function BusinessManagement() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterClaimed, setFilterClaimed] = useState('all');
    const [actionLoading, setActionLoading] = useState(null);
    const [editingBiz, setEditingBiz] = useState(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 15;

    const fetchBusinesses = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('businesses')
            .select('id, name, category, city, region, phone, claimed_by, created_at, is_active')
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (search.trim()) {
            query = query.ilike('name', `%${search}%`);
        }
        if (filterClaimed === 'claimed') {
            query = query.not('claimed_by', 'is', null);
        } else if (filterClaimed === 'unclaimed') {
            query = query.is('claimed_by', null);
        }

        const { data, error } = await query;
        if (error) console.error('BusinessManagement fetch:', error);
        setBusinesses(data || []);
        setLoading(false);
    }, [page, search, filterClaimed]);

    useEffect(() => {
        const debounce = setTimeout(fetchBusinesses, 300);
        return () => clearTimeout(debounce);
    }, [fetchBusinesses]);

    const handleDelete = async (bizId, bizName) => {
        if (!confirm(`هل أنت متأكد من حذف "${bizName}"؟ هذا لا يمكن التراجع عنه.`)) return;
        setActionLoading(bizId);
        try {
            const { error } = await supabase.from('businesses').delete().eq('id', bizId);
            if (error) throw error;
            setBusinesses(prev => prev.filter(b => b.id !== bizId));
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setActionLoading(null);
    };

    const handleToggleActive = async (bizId, currentActive) => {
        setActionLoading(bizId);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ is_active: !currentActive })
                .eq('id', bizId);
            if (error) throw error;
            setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, is_active: !currentActive } : b));
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setActionLoading(null);
    };

    const handleSaveEdit = async () => {
        if (!editingBiz) return;
        setActionLoading(editingBiz.id);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    name: editingBiz.name,
                    category: editingBiz.category,
                    city: editingBiz.city,
                    phone: editingBiz.phone,
                })
                .eq('id', editingBiz.id);
            if (error) throw error;
            setBusinesses(prev => prev.map(b => b.id === editingBiz.id ? { ...b, ...editingBiz } : b));
            setEditingBiz(null);
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setActionLoading(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Business Management</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Search business name..."
                        className="flex-1 sm:w-56 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={filterClaimed}
                        onChange={(e) => { setFilterClaimed(e.target.value); setPage(0); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                    >
                        <option value="all">All</option>
                        <option value="claimed">Claimed</option>
                        <option value="unclaimed">Unclaimed</option>
                    </select>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
            )}

            {!loading && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Business</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {businesses.map(biz => (
                                <tr key={biz.id} className={`hover:bg-slate-50 transition-colors ${biz.is_active === false ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{biz.name}</div>
                                        <div className="text-xs text-slate-400">{biz.phone || biz.id.slice(0, 8)}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                            {biz.category || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">{biz.city || biz.region || '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1.5">
                                            {biz.claimed_by ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Claimed</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Unclaimed</span>
                                            )}
                                            {biz.is_active === false && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Disabled</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingBiz({ ...biz })}
                                                className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(biz.id, biz.is_active !== false)}
                                                disabled={actionLoading === biz.id}
                                                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                                                    biz.is_active === false
                                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                } disabled:opacity-50`}
                                            >
                                                {biz.is_active === false ? 'Enable' : 'Disable'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(biz.id, biz.name)}
                                                disabled={actionLoading === biz.id}
                                                className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-md hover:bg-red-100 disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {businesses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-slate-400">No businesses found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-100">
                            ← Previous
                        </button>
                        <span className="text-xs text-slate-500">Page {page + 1}</span>
                        <button onClick={() => setPage(p => p + 1)} disabled={businesses.length < PAGE_SIZE} className="px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-100">
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingBiz && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Business</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 font-medium">Name</label>
                                <input
                                    type="text"
                                    value={editingBiz.name}
                                    onChange={(e) => setEditingBiz({ ...editingBiz, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 font-medium">Category</label>
                                <input
                                    type="text"
                                    value={editingBiz.category || ''}
                                    onChange={(e) => setEditingBiz({ ...editingBiz, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 font-medium">City</label>
                                <input
                                    type="text"
                                    value={editingBiz.city || ''}
                                    onChange={(e) => setEditingBiz({ ...editingBiz, city: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 font-medium">Phone</label>
                                <input
                                    type="text"
                                    value={editingBiz.phone || ''}
                                    onChange={(e) => setEditingBiz({ ...editingBiz, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none mt-1"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEditingBiz(null)}
                                className="flex-1 py-2.5 text-sm font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={actionLoading === editingBiz.id}
                                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
