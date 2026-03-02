'use client'

import { useState, useEffect } from 'react'
import { Ticket, Gift, Users, BadgePercent, CheckCircle2, Plus, Calendar as CalendarIcon, Upload, Loader2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function CampaignsPage() {
    const { supabase, showToast } = useTagdeer()
    const [activeTab, setActiveTab] = useState('campaigns') // campaigns, pools

    const [campaigns, setCampaigns] = useState([])
    const [pools, setPools] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const [showNewCampaignPopup, setShowNewCampaignPopup] = useState(false)
    const [showNewPoolPopup, setShowNewPoolPopup] = useState(false)
    const [newPoolParams, setNewPoolParams] = useState({ name: '', drop_logic: 'Dispense 1 code every 1 verified log' })
    const [poolFile, setPoolFile] = useState(null)
    const [isCreatingPool, setIsCreatingPool] = useState(false)

    useEffect(() => {
        if (!supabase) return;

        const fetchData = async () => {
            setIsLoading(true)
            const [campaignsData, poolsData] = await Promise.all([
                supabase.from('platform_campaigns').select('*').order('created_at', { ascending: false }),
                supabase.from('platform_coupon_pools').select('*').order('created_at', { ascending: false })
            ])

            if (campaignsData.data) setCampaigns(campaignsData.data)
            if (poolsData.data) setPools(poolsData.data)

            setIsLoading(false)
        }
        fetchData()
    }, [supabase])

    const handleCreatePool = async () => {
        if (!newPoolParams.name || !poolFile) {
            showToast("Please provide a pool name and a CSV file.");
            return;
        }

        setIsCreatingPool(true);
        // Assuming CSV parsing would calculate the amount in a real component
        const mockParsedCodesCount = Math.floor(Math.random() * 500) + 50;

        const { data, error } = await supabase.from('platform_coupon_pools').insert({
            name: newPoolParams.name,
            amount: mockParsedCodesCount,
            remaining: mockParsedCodesCount,
            drop_logic: newPoolParams.drop_logic
        }).select().single();

        if (error) {
            console.error(error);
            showToast("Failed to create pool.");
        } else {
            showToast("Coupon pool created and loaded successfully!");
            setPools(prev => [data, ...prev]);
            setShowNewPoolPopup(false);
            setNewPoolParams({ name: '', drop_logic: 'Dispense 1 code every 1 verified log' });
            setPoolFile(null);
        }
        setIsCreatingPool(false);
    }

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Marketing Engine</h1>
                    <p className="text-slate-400 mt-1">Manage global campaigns and coupon distribution pools.</p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 flex text-sm font-medium">
                        <button
                            onClick={() => setActiveTab('campaigns')}
                            className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'campaigns' ? 'bg-purple-500/10 text-purple-400 shadow-sm border border-purple-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Ticket className="w-4 h-4" /> Global Campaigns
                        </button>
                        <button
                            onClick={() => setActiveTab('pools')}
                            className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'pools' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Gift className="w-4 h-4" /> Coupon Pools
                        </button>
                    </div>

                    <button
                        onClick={() => activeTab === 'campaigns' ? setShowNewCampaignPopup(true) : setShowNewPoolPopup(true)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" /> Create {activeTab === 'campaigns' ? 'Campaign' : 'Pool'}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-8">

                {/* Campaigns Tab */}
                {activeTab === 'campaigns' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {isLoading ? (
                            <div className="col-span-full py-12 flex justify-center text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        ) : campaigns.length > 0 ? (
                            campaigns.map(campaign => (
                                <div key={campaign.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-600 transition-colors">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                                                <CalendarIcon className="w-3 h-3" /> {campaign.start_date} to {campaign.end_date}
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2">{campaign.title}</h3>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${campaign.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400 border border-slate-600'
                                                }`}>
                                                {campaign.status}
                                            </span>
                                        </div>
                                        <button className="text-slate-400 hover:text-white bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                            Manage
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mt-8 relative z-10 border-t border-slate-700/50 pt-6">
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Merchants</div>
                                            <div className="text-xl font-semibold text-white">{campaign.participants} <span className="text-xs text-slate-500 font-normal">joined</span></div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Pledged</div>
                                            <div className="text-xl font-semibold text-white">{campaign.coupons_pledged} <span className="text-xs text-slate-500 font-normal">coupons</span></div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><BadgePercent className="w-3.5 h-3.5" /> Claimed</div>
                                            <div className="text-xl font-semibold text-emerald-400">{campaign.coupons_claimed}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-slate-800/20 border-dashed border-2 border-slate-700/50 rounded-2xl p-12 text-center text-slate-500">
                                No campaigns currently running.
                            </div>
                        )}
                    </div>
                )}

                {/* Pools Tab */}
                {activeTab === 'pools' && (
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Pool Name</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Total Uploaded</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-center">Remaining Inventory</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Drop Logic</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                                ) : pools.map(pool => (
                                    <tr key={pool.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{pool.name}</div>
                                            <div className="text-xs text-slate-500">{pool.type}</div>
                                        </td>
                                        <td className="px-6 py-4">{pool.amount} items</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center">
                                                <div className="font-bold text-white flex items-baseline gap-1">
                                                    {pool.remaining} <span className="text-xs text-slate-500 font-normal">left</span>
                                                </div>
                                                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden max-w-[100px]">
                                                    <div
                                                        className={`h-full ${pool.remaining / pool.amount > 0.2 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        style={{ width: `${(pool.remaining / pool.amount) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 flex items-center gap-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider inline-flex">
                                                <span>Drop Logic:</span>
                                                <span className="text-white">{pool.drop_logic}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-slate-400 hover:text-white font-medium transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                                                Top Up Codes
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && pools.length === 0 && (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No pools initialized.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>

            {/* Modals for creations */}
            {showNewPoolPopup && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-2">Create Coupon Pool</h2>
                        <p className="text-sm text-slate-400 mb-6">Upload a CSV of codes to be distributed to users.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Pool Name</label>
                                <input type="text" value={newPoolParams.name} onChange={e => setNewPoolParams({ ...newPoolParams, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500" placeholder="e.g., Libyana 10 LYD" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Drop Logic</label>
                                <select value={newPoolParams.drop_logic} onChange={e => setNewPoolParams({ ...newPoolParams, drop_logic: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 appearance-none">
                                    <option value="Dispense 1 code every 1 verified log">Dispense 1 code every 1 verified log</option>
                                    <option value="Dispense 1 code every 5 verified logs">Dispense 1 code every 5 verified logs</option>
                                    <option value="Dispense on reaching Level 2">Dispense on reaching Level 2</option>
                                    <option value="Manual Distribution Only">Manual Distribution Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Upload Codes CSV</label>
                                <div className="border border-dashed border-slate-600 rounded-lg p-8 flex flex-col items-center justify-center text-slate-500 bg-slate-800/50 hover:bg-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer group relative">
                                    <input type="file" accept=".csv" onChange={e => setPoolFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <Upload className="w-8 h-8 mb-2 group-hover:text-emerald-400 transition-colors" />
                                    <span className="text-sm">{poolFile ? poolFile.name : "Click to select CSV list of codes"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setShowNewPoolPopup(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors border border-slate-700">Cancel</button>
                            <button disabled={isCreatingPool} onClick={handleCreatePool} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50">
                                {isCreatingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Import Codes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
