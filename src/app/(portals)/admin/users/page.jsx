'use client'

import { useState, useEffect } from 'react'
import { Search, UserX, UserMinus, ShieldAlert, Award, AlertCircle, TrendingUp, TrendingDown, History, Loader2, Settings, UserCheck, Edit3, Store, Users, User, AlertTriangle, Ban } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'
import { usePlatformConfig } from '@/hooks/usePlatformConfig'
import { formatDistanceToNow } from 'date-fns'

export default function UsersPage() {
    const { supabase, showToast } = useTagdeer()
    const platformConfig = usePlatformConfig()
    const [users, setUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'consumers', 'merchants'
    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'Active', 'Restricted', 'Banned'
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const [userLogs, setUserLogs] = useState([])
    const [merchantBusinesses, setMerchantBusinesses] = useState([])
    const [isLoadingLogs, setIsLoadingLogs] = useState(false)
    const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentReason, setAdjustmentReason] = useState('')
    const [isEditingInfo, setIsEditingInfo] = useState(false)
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
    const [showBanCascadeWarning, setShowBanCascadeWarning] = useState(false)
    const [pendingStatus, setPendingStatus] = useState(null)
    const [isChangingRole, setIsChangingRole] = useState(false)

    // Track active admin from the cookie API
    const [activeAdmin, setActiveAdmin] = useState(null)

    // Check if current user is super admin
    const { user } = useTagdeer() // Fallback
    const currentUserProfile = activeAdmin || users.find(u => u.id === user?.id)
    const currentRole = currentUserProfile?.role
    const isSuperAdmin = currentRole === 'super_admin'
    const isAdmin = currentRole === 'admin'
    const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent']
    const canManageRoles = isSuperAdmin || isAdmin

    // Fetch all users and active admin identity
    useEffect(() => {
        if (!supabase) return;

        const checkActiveAdmin = async () => {
            try {
                const res = await fetch('/api/admin/check-auth', { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    if (data.authenticated && data.user) {
                        setActiveAdmin(data.user)
                    }
                }
            } catch (err) {
                console.error("Failed to fetch active admin", err)
            }
        }
        checkActiveAdmin()

        const fetchUsers = async () => {
            setIsLoading(true)
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
            if (!error && data) {
                const th = platformConfig?.vipThresholds || { guest: 20, bronze: 1000, silver: 5000, gold: 20000 };

                const mapped = data.map(dbUser => {
                    const pts = dbUser.gader_points || 0;
                    let tier = 'Bronze';
                    if (pts >= th.gold) tier = 'VIP'; // Wait, standard logic calls > 20k VIP. Let's use 'Gold'/'VIP' mapping correctly based on prev logic.
                    // Previous logic: > 5000 ? 'Gold' : > 1000 ? 'Silver' : 'Bronze'
                    // New logic derived from calculateTier:
                    if (pts >= th.gold) tier = 'VIP';
                    else if (pts >= th.silver) tier = 'Gold';
                    else if (pts >= th.bronze) tier = 'Silver';
                    else tier = 'Bronze';

                    return {
                        id: dbUser.id,
                        name: dbUser.full_name || 'Anonymous User',
                        email: dbUser.email || '-',
                        phone: dbUser.phone || '-',
                        trustPoints: pts,
                        tier: tier,
                        flags: 0,
                        status: dbUser.status || 'Active',
                        role: dbUser.role || 'user',
                        created_at: dbUser.created_at
                    };
                })
                setUsers(mapped)
            }
            setIsLoading(false)
        }
        fetchUsers()
    }, [supabase])

    // Fetch user logs (from both interactions and logs tables)
    useEffect(() => {
        const fetchUserLogs = async () => {
            if (!selectedUser?.id || !supabase) return
            setUserLogs([])
            setIsLoadingLogs(true)

            // Fetch from interactions table (uses created_by)
            const { data: interactions, error: intError } = await supabase
                .from('interactions')
                .select('*, businesses(name)')
                .eq('created_by', selectedUser.id)
                .order('created_at', { ascending: false })
                .limit(10)

            // Fetch from logs table (uses profile_id)
            const { data: logs, error: logError } = await supabase
                .from('logs')
                .select('*, businesses(name)')
                .eq('profile_id', selectedUser.id)
                .order('created_at', { ascending: false })
                .limit(10)

            // Combine and sort chronologically
            const combined = [
                ...(interactions || []).map(i => ({ ...i, source: 'interaction' })),
                ...(logs || []).map(l => ({ ...l, source: 'log' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15)

            setUserLogs(combined)
            setIsLoadingLogs(false)
        }
        fetchUserLogs()
    }, [selectedUser, supabase])

    // Fetch merchant businesses when a merchant is selected
    useEffect(() => {
        const fetchMerchantBusinesses = async () => {
            if (!selectedUser?.id || !supabase || selectedUser.role !== 'merchant') {
                setMerchantBusinesses([])
                return
            }
            setIsLoadingBusinesses(true)
            const { data, error } = await supabase
                .from('businesses')
                .select('id, name, status, category, region')
                .eq('claimed_by', selectedUser.id)

            if (!error && data) {
                setMerchantBusinesses(data)
            } else {
                setMerchantBusinesses([])
            }
            setIsLoadingBusinesses(false)
        }
        fetchMerchantBusinesses()
    }, [selectedUser, supabase])

    // Filter users by role tab, status, and search
    const filteredUsers = users.filter(u => {
        const matchesTab = activeTab === 'all' ? true :
            activeTab === 'consumers' ? u.role === 'user' :
                activeTab === 'merchants' ? u.role === 'merchant' : true
        const matchesStatus = statusFilter === 'all' ? true : u.status === statusFilter
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.phone.includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesTab && matchesStatus && matchesSearch
    })

    // Count stats
    const consumerCount = users.filter(u => u.role === 'user').length
    const merchantCount = users.filter(u => u.role === 'merchant').length
    const restrictedCount = users.filter(u => u.status === 'Restricted').length
    const bannedCount = users.filter(u => u.status === 'Banned').length

    const handlePurge = async () => {
        if (!supabase || !selectedUser) return;
        if (confirm(`Are you sure you want to purge logs and reset Trust Points for ${selectedUser.name}? This cannot be undone.`)) {
            const { error } = await supabase.rpc('admin_purge_user', { p_user_id: selectedUser.id });
            if (error) {
                console.error('Purge RPC Error:', error);
                showToast(error.message || "Failed to purge user data.");
            } else {
                showToast(`User ${selectedUser.name} purged and reset to 0 points.`);
                setSelectedUser(null);
            }
        }
    }

    const handleAdjustment = async (type) => {
        if (!adjustmentAmount || !adjustmentReason || !supabase || !selectedUser) {
            showToast("Please enter both amount and reason.")
            return
        }
        const amount = type === 'add' ? Math.abs(parseInt(adjustmentAmount)) : -Math.abs(parseInt(adjustmentAmount));
        if (isNaN(amount)) {
            showToast("Invalid amount.");
            return;
        }
        setIsSaving(true);
        const { error } = await supabase.rpc('admin_manage_user_gader', {
            p_user_id: selectedUser.id,
            p_amount: amount,
            p_reason: adjustmentReason
        });
        if (error) {
            console.error('Adjustment RPC Error:', error);
            showToast(error.hint || error.message || "Failed to adjust points.");
        } else {
            showToast(`${type === 'add' ? 'Awarded' : 'Deducted'} ${Math.abs(amount)} points.`);
            const updatedUser = { ...selectedUser, trustPoints: Math.max((selectedUser.trustPoints || 0) + amount, 0) };
            setSelectedUser(updatedUser);
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, trustPoints: updatedUser.trustPoints } : u));
        }
        setIsSaving(false);
        setAdjustmentAmount('')
        setAdjustmentReason('')
    }

    const handleStatusUpdate = async (newStatus) => {
        if (!supabase || !selectedUser) return;

        // If merchant has businesses and is being banned/restricted, show warning first
        if (selectedUser.role === 'merchant' && (newStatus === 'Banned' || newStatus === 'Restricted') && merchantBusinesses.length > 0) {
            setPendingStatus(newStatus)
            setShowBanCascadeWarning(true)
            return
        }

        await executeStatusUpdate(newStatus)
    }

    const executeStatusUpdate = async (newStatus) => {
        setShowBanCascadeWarning(false)
        setPendingStatus(null)
        setIsSaving(true);
        const { error } = await supabase.rpc('admin_update_user_status', {
            p_user_id: selectedUser.id,
            p_role: selectedUser.role,
            p_status: newStatus
        });
        if (error) {
            console.error('Status Update RPC Error:', error);
            showToast(error.hint || error.message || "Failed to update status.");
        } else {
            const cascadeMsg = selectedUser.role === 'merchant' && merchantBusinesses.length > 0
                ? ` (${merchantBusinesses.length} business${merchantBusinesses.length > 1 ? 'es' : ''} affected)`
                : ''
            showToast(`User status updated to ${newStatus}.${cascadeMsg}`);
            setSelectedUser(prev => ({ ...prev, status: newStatus }));
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));

            // Refresh merchant businesses to show updated statuses
            if (selectedUser.role === 'merchant') {
                const { data } = await supabase
                    .from('businesses')
                    .select('id, name, status, category, region')
                    .eq('claimed_by', selectedUser.id)
                if (data) setMerchantBusinesses(data)
            }
        }
        setIsSaving(false);
    }

    const handleUpdateUserInfo = async () => {
        if (!supabase || !selectedUser) return;
        setIsSaving(true);
        const { error } = await supabase.rpc('admin_update_user_info', {
            p_user_id: selectedUser.id,
            p_full_name: editForm.name,
            p_email: editForm.email,
            p_phone: editForm.phone
        });
        if (error) {
            console.error('Info Update RPC Error:', error);
            showToast(error.hint || error.message || "Failed to update user info.");
        } else {
            showToast("User information updated.");
            const updated = { ...selectedUser, name: editForm.name, email: editForm.email, phone: editForm.phone };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === selectedUser.id ? updated : u));
            setIsEditingInfo(false);
        }
        setIsSaving(false);
    }

    const handleRoleChange = async (newRole) => {
        if (!supabase || !selectedUser) return;
        if (!confirm(`Are you sure you want to change ${selectedUser.name}'s role to "${newRole.replace('_', ' ')}"?`)) return;

        setIsChangingRole(true);
        const { data, error } = await supabase.rpc('admin_update_user_role', {
            p_user_id: selectedUser.id,
            p_new_role: newRole
        });

        if (error || !data?.success) {
            showToast(error?.message || data?.error || "Failed to update role", "error");
        } else {
            showToast(`Role updated to ${newRole.replace('_', ' ')}`);
            const updated = { ...selectedUser, role: newRole };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
        }
        setIsChangingRole(false);
    }

    const startEditing = () => {
        setEditForm({ name: selectedUser.name, email: selectedUser.email, phone: selectedUser.phone });
        setIsEditingInfo(true);
    }

    const getRoleBadge = (role) => {
        switch (role) {
            case 'merchant':
                return <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-blue-500/20">Merchant</span>
            case 'super_admin':
                return <span className="bg-rose-500/10 text-rose-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-rose-500/20">Super Admin</span>
            case 'admin':
                return <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-purple-500/20">Admin</span>
            case 'assistant_admin':
                return <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-indigo-500/20">Asst Admin</span>
            case 'support_agent':
                return <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-cyan-500/20">Support</span>
            default:
                return <span className="bg-slate-500/10 text-slate-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-slate-500/20">Consumer</span>
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Banned':
                return <span className="bg-red-500/10 text-red-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-red-500/20">Banned</span>
            case 'Restricted':
                return <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/20">Restricted</span>
            default:
                return <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-emerald-500/20">Active</span>
        }
    }

    const getBusinessStatusBadge = (status) => {
        switch (status) {
            case 'hidden':
                return <span className="bg-red-500/10 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-bold">Hidden</span>
            case 'restricted':
                return <span className="bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold">Restricted</span>
            case 'pending_review':
                return <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-bold">Pending Review</span>
            default:
                return <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold">Published</span>
        }
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-8rem)]">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
                    <p className="text-slate-400 mt-1">Manage platform users, enforce rules, and monitor accounts.</p>
                </div>

                <div className="flex gap-3 items-center">
                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Active">Active ({users.filter(u => u.status === 'Active').length})</option>
                        <option value="Restricted">Restricted ({restrictedCount})</option>
                        <option value="Banned">Banned ({bannedCount})</option>
                    </select>

                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors w-full sm:w-72"
                        />
                    </div>
                </div>
            </div>

            {/* Role Tabs - Dropdown on mobile, buttons on desktop */}
            <div className="flex gap-2 mb-4 shrink-0 items-center">
                {/* Mobile dropdown */}
                <select
                    value={activeTab}
                    onChange={e => { setActiveTab(e.target.value); setSelectedUser(null) }}
                    className="md:hidden bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                    <option value="all">All Users ({users.length})</option>
                    <option value="consumers">Consumers ({consumerCount})</option>
                    <option value="merchants">Merchants ({merchantCount})</option>
                </select>

                {/* Desktop buttons */}
                <button
                    onClick={() => { setActiveTab('all'); setSelectedUser(null) }}
                    className={`hidden md:flex px-4 py-2 rounded-lg text-sm font-medium transition-colors items-center gap-2 ${activeTab === 'all'
                        ? 'bg-slate-700 text-white shadow-sm border border-slate-600'
                        : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'}`}
                >
                    <Users className="w-4 h-4" /> All Users
                    <span className="text-[10px] bg-slate-600/50 px-1.5 py-0.5 rounded-full">{users.length}</span>
                </button>
                <button
                    onClick={() => { setActiveTab('consumers'); setSelectedUser(null) }}
                    className={`hidden md:flex px-4 py-2 rounded-lg text-sm font-medium transition-colors items-center gap-2 ${activeTab === 'consumers'
                        ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:text-emerald-300 border border-slate-700/50'}`}
                >
                    <User className="w-4 h-4" /> Consumers
                    <span className="text-[10px] bg-slate-600/50 px-1.5 py-0.5 rounded-full">{consumerCount}</span>
                </button>
                <button
                    onClick={() => { setActiveTab('merchants'); setSelectedUser(null) }}
                    className={`hidden md:flex px-4 py-2 rounded-lg text-sm font-medium transition-colors items-center gap-2 ${activeTab === 'merchants'
                        ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:text-blue-300 border border-slate-700/50'}`}
                >
                    <Store className="w-4 h-4" /> Merchants
                    <span className="text-[10px] bg-slate-600/50 px-1.5 py-0.5 rounded-full">{merchantCount}</span>
                </button>

                {/* Status summary badges */}
                {(restrictedCount > 0 || bannedCount > 0) && (
                    <div className="flex items-center gap-2 ml-auto">
                        {restrictedCount > 0 && (
                            <span className="text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg font-medium">
                                {restrictedCount} Restricted
                            </span>
                        )}
                        {bannedCount > 0 && (
                            <span className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg font-medium">
                                {bannedCount} Banned
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">

                {/* User List */}
                <div className={`transition-all duration-300 flex flex-col min-h-0 ${selectedUser ? 'hidden md:flex md:w-1/2' : 'w-full'}`}>
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col flex-1">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm text-slate-400 min-w-[600px]">
                                <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">User Details</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Role</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-center">Trust Points & Tier</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Status</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr
                                            key={user.id}
                                            className={`border-b border-slate-700/50 transition-colors cursor-pointer ${selectedUser?.id === user.id
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : user.status === 'Banned' ? 'hover:bg-red-900/10' : user.status === 'Restricted' ? 'hover:bg-amber-900/10' : 'hover:bg-slate-800/50'
                                                }`}
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{user.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{user.phone} • {user.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getRoleBadge(user.role)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="font-bold text-white mb-1">{user.trustPoints} PTS</div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${user.tier === 'Gold' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                    user.tier === 'Silver' ? 'bg-slate-300/10 text-slate-300 border border-slate-300/20' :
                                                        'bg-amber-700/10 text-amber-600 border border-amber-700/20'
                                                    }`}>
                                                    {user.tier}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(user.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors text-xs">View Profile</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                {isLoading ? (
                                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                                        Loading users...
                                                    </div>
                                                ) : "No users found matching your criteria."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* User Profile View Sidebar */}
                {selectedUser && (
                    <div className="w-full md:w-1/2 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300 fixed md:relative inset-0 md:inset-auto z-40 md:z-auto">
                        {/* Profile Header */}
                        <div className="p-6 border-b border-slate-700/50 bg-slate-800 shrink-0">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                    <div className={`h-16 w-16 rounded-full border-2 flex items-center justify-center text-xl font-bold text-white shadow-inner ${selectedUser.role === 'merchant' ? 'bg-blue-900/50 border-blue-500/50' : 'bg-slate-700 border-slate-600'}`}>
                                        {selectedUser.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                            {selectedUser.name}
                                            <button onClick={startEditing} className="p-1 hover:bg-slate-700 rounded-full text-slate-500 hover:text-emerald-400 transition-colors">
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        </h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm text-slate-400">{selectedUser.phone} • {selectedUser.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {getRoleBadge(selectedUser.role)}
                                            {getStatusBadge(selectedUser.status)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedUser(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
                                        <UserX className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Key Stats */}
                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Trust Points</div>
                                    <div className="text-xl font-bold text-emerald-400">{selectedUser.trustPoints}</div>
                                </div>
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Current Tier</div>
                                    <div className="text-xl font-bold tracking-wide text-yellow-500">{selectedUser.tier}</div>
                                </div>
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Account Status</div>
                                    <div className={`text-xl font-bold ${selectedUser.status === 'Banned' ? 'text-red-400' : selectedUser.status === 'Restricted' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {selectedUser.status}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">

                            {/* Ban Cascade Warning Modal */}
                            {showBanCascadeWarning && (
                                <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-5 animate-in slide-in-from-top-4 duration-300">
                                    <h3 className="flex items-center gap-2 font-bold text-red-400 mb-3">
                                        <AlertTriangle className="w-5 h-5" /> Merchant Business Impact Warning
                                    </h3>
                                    <p className="text-sm text-red-200/80 mb-3">
                                        {pendingStatus === 'Banned'
                                            ? `Banning this merchant will HIDE all ${merchantBusinesses.length} of their businesses from the platform.`
                                            : `Restricting this merchant will RESTRICT all ${merchantBusinesses.length} of their businesses.`
                                        }
                                    </p>
                                    <div className="space-y-2 mb-4">
                                        {merchantBusinesses.map(b => (
                                            <div key={b.id} className="flex items-center justify-between bg-red-900/20 rounded-lg px-3 py-2">
                                                <span className="text-sm text-red-200">{b.name}</span>
                                                <span className="text-[10px] text-slate-400">{b.status} → {pendingStatus === 'Banned' ? 'hidden' : 'restricted'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => executeStatusUpdate(pendingStatus)}
                                            className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                                        >
                                            {pendingStatus === 'Banned' ? 'Confirm Ban' : 'Confirm Restriction'}
                                        </button>
                                        <button
                                            onClick={() => { setShowBanCascadeWarning(false); setPendingStatus(null); }}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Edit Information Form */}
                            {isEditingInfo && (
                                <div className="mb-8 bg-slate-900 border border-emerald-500/30 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
                                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-emerald-400" /> Edit User Information
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                value={editForm.name}
                                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                    value={editForm.email}
                                                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                    value={editForm.phone}
                                                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                disabled={isSaving}
                                                onClick={handleUpdateUserInfo}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-md transition-colors text-sm font-bold disabled:opacity-50"
                                            >
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                            <button
                                                onClick={() => setIsEditingInfo(false)}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-md transition-colors text-sm font-medium"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Status Management */}
                            <div className="mb-8">
                                <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> Account Status Control
                                </h3>
                                <div className="flex gap-3">
                                    <button
                                        disabled={isSaving || selectedUser.status === 'Active'}
                                        onClick={() => handleStatusUpdate('Active')}
                                        className={`flex-1 py-2.5 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-bold ${selectedUser.status === 'Active'
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400'
                                            }`}
                                    >
                                        <UserCheck className="w-4 h-4" /> Active
                                    </button>
                                    <button
                                        disabled={isSaving || selectedUser.status === 'Restricted'}
                                        onClick={() => handleStatusUpdate('Restricted')}
                                        className={`flex-1 py-2.5 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-bold ${selectedUser.status === 'Restricted'
                                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-amber-500/50 hover:text-amber-400'
                                            }`}
                                    >
                                        <AlertCircle className="w-4 h-4" /> Restrict
                                    </button>
                                    <button
                                        disabled={isSaving || selectedUser.status === 'Banned'}
                                        onClick={() => handleStatusUpdate('Banned')}
                                        className={`flex-1 py-2.5 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-bold ${selectedUser.status === 'Banned'
                                            ? 'bg-red-500/10 border-red-500/50 text-red-500'
                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-red-500/50 hover:text-red-400'
                                            }`}
                                    >
                                        <ShieldAlert className="w-4 h-4" /> Ban
                                    </button>
                                </div>
                            </div>

                            {/* Role Management - Admins & Super Admins Only */}
                            {canManageRoles && selectedUser.id !== user?.id && (
                                <div className="mb-8">
                                    <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-purple-400" /> Role Management
                                    </h3>
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-inner">
                                        <label className="block text-xs font-medium text-slate-400 mb-2">Assign Platform Role</label>
                                        <div className="flex gap-3">
                                            <select
                                                value={selectedUser.role}
                                                onChange={(e) => handleRoleChange(e.target.value)}
                                                disabled={isChangingRole}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50 appearance-none"
                                            >
                                                <option value="user">Consumer (User)</option>
                                                <option value="merchant">Merchant</option>
                                                <option value="support_agent">Support Agent</option>
                                                <option value="assistant_admin">Assistant Admin</option>
                                                <option value="admin">Admin</option>
                                                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                                            </select>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            Admin-level roles immediately grant access to the Admin Portal.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Merchant Businesses Section */}
                            {selectedUser.role === 'merchant' && (
                                <div className="mb-8">
                                    <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                        <Store className="w-4 h-4 text-blue-400" /> Claimed Businesses
                                    </h3>
                                    {isLoadingBusinesses ? (
                                        <div className="py-4 flex justify-center text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        </div>
                                    ) : merchantBusinesses.length > 0 ? (
                                        <div className="space-y-2">
                                            {merchantBusinesses.map(b => (
                                                <div key={b.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-white text-sm">{b.name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{b.category} • {b.region}</div>
                                                    </div>
                                                    {getBusinessStatusBadge(b.status)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">No businesses claimed by this merchant.</div>
                                    )}
                                </div>
                            )}

                            {/* Manual Adjustment */}
                            <div className="mb-8">
                                <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                    <Award className="w-4 h-4" /> Manual Points Adjustment
                                </h3>
                                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-inner">
                                    <div className="flex gap-4 mb-3">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Amount (PTS)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                placeholder="e.g. 50"
                                                value={adjustmentAmount}
                                                onChange={e => setAdjustmentAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Reason for audit log</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                placeholder="e.g. Good Samaritan Bonus"
                                                value={adjustmentReason}
                                                onChange={e => setAdjustmentReason(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            disabled={isSaving}
                                            onClick={() => handleAdjustment('add')}
                                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <TrendingUp className="w-4 h-4" /> {isSaving ? '...' : 'Award Points'}
                                        </button>
                                        <button
                                            disabled={isSaving}
                                            onClick={() => handleAdjustment('deduct')}
                                            className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <TrendingDown className="w-4 h-4" /> {isSaving ? '...' : 'Deduct Penalty'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Log History Preview */}
                            <div>
                                <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                    <History className="w-4 h-4" /> Recent Activity Logs
                                </h3>
                                <div className="space-y-3">
                                    {isLoadingLogs ? (
                                        <div className="py-6 flex justify-center text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        </div>
                                    ) : userLogs.length > 0 ? (
                                        userLogs.map(log => (
                                            <div key={log.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`font-medium ${log.interaction_type === 'verified_receipt' ? 'text-emerald-400' :
                                                        log.interaction_type === 'recommend' ? 'text-emerald-400' :
                                                            log.interaction_type === 'complain' ? 'text-red-400' : 'text-slate-300'}`}>
                                                        {log.interaction_type === 'verified_receipt' ? 'Receipt Upload' :
                                                            log.interaction_type === 'recommend' ? 'Recommendation' :
                                                                log.interaction_type === 'complain' ? 'Complaint' : log.interaction_type}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${log.source === 'interaction' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-600/30 text-slate-400'}`}>
                                                            {log.source === 'interaction' ? 'Interaction' : 'Log'}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-slate-400 text-xs">
                                                    At {log.businesses?.name || 'Unknown Business'} ({log.weight > 0 ? '+' : ''}{log.weight || 0} PTS)
                                                    {log.reason_text && ` • "${log.reason_text}"`}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">No activity logged yet.</div>
                                    )}
                                </div>
                            </div>

                            {/* Purge Section */}
                            <div className="mt-8 pt-6 border-t border-slate-700/50">
                                <button
                                    onClick={handlePurge}
                                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <UserMinus className="w-4 h-4" /> Purge Logs & Reset Points
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
