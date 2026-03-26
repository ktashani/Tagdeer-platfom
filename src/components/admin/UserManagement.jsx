'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Admin User Management — search, view, role change, ban users.
 */

const ROLES = [
    { value: 'consumer', label: 'Consumer', color: 'bg-slate-100 text-slate-700' },
    { value: 'merchant', label: 'Merchant', color: 'bg-blue-100 text-blue-700' },
    { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
    { value: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-700' },
    { value: 'support_agent', label: 'Support', color: 'bg-teal-100 text-teal-700' },
];

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [actionLoading, setActionLoading] = useState(null);
    const [expandedUser, setExpandedUser] = useState(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('profiles')
            .select('id, full_name, phone, email, role, gader, is_banned, created_at, city, gender')
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (roleFilter !== 'all') {
            query = query.eq('role', roleFilter);
        }
        if (search.trim()) {
            query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) console.error('UserManagement fetch:', error);
        setUsers(data || []);
        setLoading(false);
    }, [page, roleFilter, search]);

    useEffect(() => {
        const debounce = setTimeout(fetchUsers, 300);
        return () => clearTimeout(debounce);
    }, [fetchUsers]);

    const handleRoleChange = async (userId, newRole) => {
        setActionLoading(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);
            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setActionLoading(null);
    };

    const handleBanToggle = async (userId, currentBan) => {
        setActionLoading(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_banned: !currentBan })
                .eq('id', userId);
            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentBan } : u));
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setActionLoading(null);
    };

    const getRoleConfig = (role) => ROLES.find(r => r.value === role) || ROLES[0];

    return (
        <div className="space-y-4">
            {/* Header + Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">User Management</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Search name, phone, email..."
                        className="flex-1 sm:w-64 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={roleFilter}
                        onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                    >
                        <option value="all">All Roles</option>
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
            )}

            {/* User Table */}
            {!loading && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Gader</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => {
                                const roleConf = getRoleConfig(user.role);
                                const isExpanded = expandedUser === user.id;
                                return (
                                    <React.Fragment key={user.id}>
                                        <tr className={`hover:bg-slate-50 transition-colors ${user.is_banned ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                                                    className="text-left"
                                                >
                                                    <div className="font-medium text-slate-900">{user.full_name || 'Unnamed'}</div>
                                                    <div className="text-xs text-slate-400">{user.phone || user.email || user.id.slice(0, 8)}</div>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleConf.color}`}>
                                                    {roleConf.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-blue-700">{user.gader || 0}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.is_banned ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Banned</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                        disabled={actionLoading === user.id}
                                                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none"
                                                    >
                                                        {ROLES.map(r => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleBanToggle(user.id, user.is_banned)}
                                                        disabled={actionLoading === user.id}
                                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                                            user.is_banned
                                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        } disabled:opacity-50`}
                                                    >
                                                        {user.is_banned ? 'Unban' : 'Ban'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 bg-slate-50">
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500">
                                                        <div><span className="font-medium text-slate-700">ID:</span> {user.id.slice(0, 12)}…</div>
                                                        <div><span className="font-medium text-slate-700">City:</span> {user.city || '—'}</div>
                                                        <div><span className="font-medium text-slate-700">Gender:</span> {user.gender || '—'}</div>
                                                        <div><span className="font-medium text-slate-700">Joined:</span> {new Date(user.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-slate-400">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-100"
                        >
                            ← Previous
                        </button>
                        <span className="text-xs text-slate-500">Page {page + 1}</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={users.length < PAGE_SIZE}
                            className="px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-100"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Need React import for Fragment
import React from 'react';
