'use client';
'use client'

import { useState, useEffect } from 'react'
import { Search, UserX, UserMinus, ShieldAlert, Award, AlertTriangle, AlertCircle, TrendingUp, TrendingDown, History, Loader2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'
import { formatDistanceToNow } from 'date-fns'

export default function UsersPage() {
    const { supabase, showToast } = useTagdeer()
    const [users, setUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all') // 'all' or 'anti-cheat'
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const [userLogs, setUserLogs] = useState([])
    const [isLoadingLogs, setIsLoadingLogs] = useState(false)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentReason, setAdjustmentReason] = useState('')

    useEffect(() => {
        if (!supabase) return;
        const fetchUsers = async () => {
            setIsLoading(true)
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
            if (!error && data) {
                const mapped = data.map(dbUser => ({
                    id: dbUser.id,
                    name: dbUser.full_name || 'Anonymous User',
                    email: dbUser.profile_email || dbUser.email || '-',
                    phone: dbUser.phone || '-',
                    trustPoints: dbUser.gader || 0,
                    tier: (dbUser.gader || 0) > 5000 ? 'Gold' : (dbUser.gader || 0) > 1000 ? 'Silver' : 'Bronze',
                    flags: 0,
                    status: 'Active',
                    isFlagged: false,
                    flagReason: ''
                }))
                setUsers(mapped)
            }
            setIsLoading(false)
        }
        fetchUsers()
    }, [supabase])

    useEffect(() => {
        const fetchUserLogs = async () => {
            if (!selectedUser?.id || !supabase) return
            setUserLogs([])
            setIsLoadingLogs(true)
            const { data, error } = await supabase
                .from('interactions') // Fixed: changed from 'logs' to 'interactions'
                .select('*, businesses(name)')
                .eq('profile_id', selectedUser.id)
                .order('created_at', { ascending: false })
                .limit(10)

            if (!error && data) {
                setUserLogs(data)
            }
            setIsLoadingLogs(false)
        }
        fetchUserLogs()
    }, [selectedUser, supabase])

    const filteredUsers = users.filter(u =>
        (activeTab === 'anti-cheat' ? u.isFlagged : true) &&
        (u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.phone.includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handlePurge = async () => {
        if (!supabase || !selectedUser) return;

        if (confirm(`Are you sure you want to purge logs and reset Trust Points for ${selectedUser.name}? This cannot be undone.`)) {
            const { error } = await supabase.rpc('admin_purge_user', { p_user_id: selectedUser.id });

            if (error) {
                console.error(error);
                showToast("Failed to purge user data.");
            } else {
                showToast(`User ${selectedUser.name} purged and reset to 0 points.`);
                setSelectedUser(null);
                // The main users listener in TagdeerContext or a local refetch would update the UI
            }
        }
    }

    const handleAdjustment = async (type) => {
        if (!adjustmentAmount || !adjustmentReason || !supabase || !selectedUser) {
            showToast("Please enter both amount and reason.")
            return
        }

        const amount = type === 'add' ? parseInt(adjustmentAmount) : -parseInt(adjustmentAmount);

        const { error } = await supabase.rpc('admin_manage_user_gader', {
            p_user_id: selectedUser.id,
            p_amount: amount,
            p_reason: adjustmentReason
        });

        if (error) {
            console.error(error);
            showToast("Failed to adjust points.");
        } else {
            showToast(`${type === 'add' ? 'Awarded' : 'Deducted'} ${Math.abs(amount)} points.`);
            // Optimistic UI Update locally
            setSelectedUser(prev => ({ ...prev, trustPoints: Math.max((prev.trustPoints || 0) + amount, 0) }));
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, trustPoints: Math.max(u.trustPoints + amount, 0) } : u));
        }

        setAdjustmentAmount('')
        setAdjustmentReason('')
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-8rem)]">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
                    <p className="text-slate-400 mt-1">Monitor VIP economy and enforce platform rules.</p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 flex text-sm font-medium">
                        <button
                            onClick={() => { setActiveTab('all'); setSelectedUser(null) }}
                            className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            All Users
                        </button>
                        <button
                            onClick={() => { setActiveTab('anti-cheat'); setSelectedUser(null) }}
                            className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'anti-cheat' ? 'bg-red-500/10 text-red-400 shadow-sm border border-red-500/20' : 'text-slate-400 hover:text-red-300'}`}
                        >
                            <ShieldAlert className="w-4 h-4" /> Anti-Cheat Flags
                            {users.filter(u => u.isFlagged).length > 0 && (
                                <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center ml-1">
                                    {users.filter(u => u.isFlagged).length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors w-72"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">

                {/* User List */}
                <div className={`transition-all duration-300 flex flex-col min-h-0 ${selectedUser ? 'w-1/2' : 'w-full'}`}>
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col flex-1">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">User Details</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-center">Trust Points & Tier</th>
                                        {activeTab === 'anti-cheat' && <th scope="col" className="px-6 py-4 font-medium text-red-400">System Flag</th>}
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
                                                : activeTab === 'anti-cheat' ? 'hover:bg-red-900/10' : 'hover:bg-slate-800/50'
                                                }`}
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{user.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{user.phone} • {user.email}</div>
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
                                            {activeTab === 'anti-cheat' && (
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-red-400 max-w-[200px] line-clamp-2">
                                                        <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
                                                        {user.flagReason}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    {user.flags > 0 && <span className="text-red-400 font-bold text-xs">{user.flags} Flags</span>}
                                                    {user.flags === 0 && <span className="text-emerald-400 font-bold text-xs">Clean</span>}
                                                </div>
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
                    <div className="w-1/2 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
                        {/* Profile Header */}
                        <div className="p-6 border-b border-slate-700/50 bg-slate-800 shrink-0">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                    <div className="h-16 w-16 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                                        {selectedUser.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                            {selectedUser.name}
                                            {selectedUser.flags > 2 && <ShieldAlert className="w-5 h-5 text-red-500" />}
                                        </h2>
                                        <p className="text-sm text-slate-400 mt-1">{selectedUser.phone} • {selectedUser.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-white transition-colors">
                                    <UserX className="w-5 h-5" />
                                </button>
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
                                <div className="bg-slate-900 border border-amber-500/20 rounded-lg p-3 text-center">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Violation Flags</div>
                                    <div className={`text-xl font-bold ${selectedUser.flags > 0 ? 'text-red-400' : 'text-slate-300'}`}>{selectedUser.flags}</div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">

                            {/* Anti-Cheat Alert */}
                            {selectedUser.isFlagged && (
                                <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <h3 className="flex items-center gap-2 font-bold text-red-400 mb-2">
                                        <AlertTriangle className="w-5 h-5" /> Anti-Cheat System Flag
                                    </h3>
                                    <p className="text-sm text-red-200/80 mb-4">{selectedUser.flagReason}</p>
                                    <button
                                        onClick={handlePurge}
                                        className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                    >
                                        <UserMinus className="w-4 h-4" /> Purge Logs & Reset Points
                                    </button>
                                </div>
                            )}

                            {/* Manual Adjustment */}
                            <div className="mb-8">
                                <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2">Manual Points Adjustment</h3>
                                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
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
                                        <button onClick={() => handleAdjustment('add')} className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                                            <TrendingUp className="w-4 h-4" /> Award Points
                                        </button>
                                        <button onClick={() => handleAdjustment('deduct')} className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                                            <TrendingDown className="w-4 h-4" /> Deduct Penalty
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Log History Preview */}
                            <div>
                                <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                    <History className="w-4 h-4" /> Recent Interactions
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
                                                    <span className={`font-medium ${log.interaction_type === 'verified_receipt' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                        {log.interaction_type === 'verified_receipt' ? 'Receipt Upload' :
                                                            log.interaction_type === 'recommend' ? 'Recommendation' :
                                                                log.interaction_type === 'complain' ? 'Complaint' : log.interaction_type}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <div className="text-slate-400 text-xs">
                                                    At {log.businesses?.name || 'Unknown Business'} ({log.weight > 0 ? '+' : ''}{log.weight || 0} PTS)
                                                    {log.reason_text && ` • "${log.reason_text}"`}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">No interactions logged yet.</div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
