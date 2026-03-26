'use client'

import { useState, useEffect } from 'react'
import { Ticket, Store, Loader2, Upload, FileUp, Download, Search, Filter } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTagdeer } from '@/context/TagdeerContext'
import Pagination from '@/components/ui/PaginationNav'
import { SkeletonCardGrid } from '@/components/ui/SkeletonLoaders'

export default function CampaignsPage() {
    const { supabase, showToast } = useTagdeer()
    const [coupons, setCoupons] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 10
    const [stats, setStats] = useState({
        totalPledged: 0,
        totalClaimed: 0,
        totalRedeemed: 0,
        activeCampaigns: 0
    })

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [csvFile, setCsvFile] = useState(null);
    const [csvPreview, setCsvPreview] = useState([]);
    const [isUploadingVouchers, setIsUploadingVouchers] = useState(false);

    // Filters & Export (Phase 5c)
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!supabase) return;

        const fetchData = async () => {
            setIsLoading(true)

            // Fetch all merchant coupons joined with business name
            const { data: couponsData, error } = await supabase
                .from('merchant_coupons')
                .select('*, businesses(name, region)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching admin coupons:", error);
                showToast("Failed to load coupon data.");
            } else if (couponsData) {
                setCoupons(couponsData);

                // Calculate Stats
                const pledged = couponsData.reduce((acc, c) => acc + (c.initial_quantity || 0), 0);
                const claimed = couponsData.reduce((acc, c) => acc + (c.claimed_count || 0), 0);
                const active = couponsData.filter(c => c.status === 'active').length;

                setStats({
                    totalPledged: pledged,
                    totalClaimed: claimed,
                    totalRedeemed: 0, // Need coupon_redemptions table for this if we want it exact
                    activeCampaigns: active
                });
            }

            setIsLoading(false)
        }
        fetchData()
    }, [supabase])

    const updateCouponStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('merchant_coupons')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setCoupons(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            showToast(`Campaign ${newStatus} successfully.`);
        } catch (err) {
            console.error(err);
            showToast("Failed to update campaign status.");
        }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            // Default header assumption: code, provider, denomination
            const parsed = lines.slice(1).map(line => {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const [code, provider, denom] = parts.map(s => s.trim());
                    return { code, provider, denomination: parseFloat(denom) };
                }
                return null;
            }).filter(i => i && i.code && i.provider);
            setCsvPreview(parsed);
        };
        reader.readAsText(file);
    };

    const handleImportSubmit = async () => {
        if (csvPreview.length === 0) return;
        setIsUploadingVouchers(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const batchId = `batch_${Date.now()}`;
            const inserts = csvPreview.map(item => ({
                code: item.code,
                provider: item.provider,
                denomination: item.denomination || null,
                imported_by: user.id,
                batch_id: batchId
            }));

            const { error } = await supabase.from('voucher_codes').insert(inserts);
            if (error) throw error;
            
            showToast(`Imported ${inserts.length} vouchers successfully.`);
            setIsImportModalOpen(false);
            setCsvPreview([]);
            setCsvFile(null);
        } catch (err) {
            console.error(err);
            showToast("Failed to upload vouchers. Ensure no duplicate codes exist.");
        } finally {
            setIsUploadingVouchers(false);
        }
    };

    const handleExportAudit = async () => {
        setIsExporting(true);
        try {
            const { data, error } = await supabase
                .from('coupon_audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2000);
            
            if (error) throw error;
            
            const headers = ['id', 'profile_id', 'business_id', 'campaign_id', 'trigger_type', 'points_spent', 'tier_at_time', 'created_at'].join(',');
            const rows = data.map(r => [r.id, r.profile_id, r.business_id, r.campaign_id, r.trigger_type, r.points_spent, r.tier_at_time, r.created_at].join(','));
            const csv = [headers, ...rows].join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tagdeer_coupon_audit_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            showToast("Audit log exported");
        } catch (err) {
            console.error(err);
            showToast("Failed to export audit log");
        } finally {
            setIsExporting(false);
        }
    };

    const filteredCoupons = coupons.filter(c => {
        if (filterStatus !== 'all' && c.status !== filterStatus) return false;
        if (searchQuery && !c.businesses?.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !c.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Marketing Engine</h1>
                    <p className="text-slate-400 mt-1">Platform-wide liability tracking and merchant campaign monitoring.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <Button 
                        onClick={handleExportAudit}
                        disabled={isExporting}
                        className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Export Audit
                    </Button>
                    <Button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <FileUp className="w-4 h-4 mr-2" />
                        Import Vouchers
                    </Button>
                    <div className="bg-[#1A1C23] border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Platform Liability</p>
                            <p className="text-lg font-bold text-white leading-none mt-1">{stats.totalPledged} <span className="text-xs text-slate-400 font-normal">Pledged</span></p>
                        </div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Active Exposure</p>
                            <p className="text-lg font-bold text-indigo-400 leading-none mt-1">{stats.totalClaimed} <span className="text-xs text-slate-400 font-normal">Claimed</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input 
                        placeholder="Search by business name or campaign title..." 
                        className="pl-9 bg-[#1A1C23] border-slate-700 text-white placeholder:text-slate-500"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex gap-2">
                    <select 
                        className="bg-[#1A1C23] border border-slate-700 text-white rounded-md px-3 py-2 text-sm max-w-[150px]"
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="exhausted">Exhausted</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
            </div>

            {/* Campaigns List */}
            <div className="space-y-4">
                {isLoading ? (
                    <SkeletonCardGrid count={4} variant="dark" />
                ) : filteredCoupons.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {filteredCoupons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(coupon => (
                                <div key={coupon.id} className="bg-[#1A1C23] border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-colors relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl -mr-10 -mt-10 ${coupon.status === 'active' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}></div>

                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`${coupon.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'
                                                    } rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider border`}>
                                                    {coupon.status}
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono">#{coupon.id.substring(0, 8)}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-1">{coupon.title || `${coupon.discount_value}% Discount`}</h3>
                                            <p className="text-sm text-slate-400 flex items-center gap-1.5">
                                                <Store className="w-3.5 h-3.5" /> {coupon.businesses?.name} <span className="text-slate-600">•</span> {coupon.businesses?.region}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {coupon.status === 'active' ? (
                                                <button
                                                    onClick={() => updateCouponStatus(coupon.id, 'paused')}
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    Pause Campaign
                                                </button>
                                            ) : coupon.status === 'paused' ? (
                                                <button
                                                    onClick={() => updateCouponStatus(coupon.id, 'active')}
                                                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    Resume
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6 mt-8 border-t border-slate-800 pt-6">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Inventory</p>
                                            <p className="text-lg font-bold text-white leading-none">
                                                {coupon.initial_quantity} <span className="text-xs text-slate-500 font-normal">total</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Claimed</p>
                                            <p className="text-lg font-bold text-indigo-400 leading-none">{coupon.claimed_count || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Channel</p>
                                            <p className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded inline-block mt-1 uppercase tracking-tight">
                                                {coupon.distribution_rule?.replace('_', ' ')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, ((coupon.claimed_count || 0) / coupon.initial_quantity) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredCoupons.length > PAGE_SIZE && (
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredCoupons.length}
                                pageSize={PAGE_SIZE}
                                onPageChange={setCurrentPage}
                                variant="dark"
                            />
                        )}
                    </>
                ) : (
                    <div className="py-20 text-center bg-[#1A1C23] border border-dashed border-slate-700 rounded-2xl">
                        <Ticket className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500">No active merchant campaigns found.</p>
                    </div>
                )}
            </div>

            {/* Import Vouchers Modal */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="sm:max-w-[600px] bg-[#1A1C23] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Import Telecom Vouchers</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Upload a CSV file containing voucher codes (Libyana, Almadar).
                            Format required: <code>code, provider, denomination</code>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-800/20 relative">
                            <Input 
                                type="file" 
                                accept=".csv,.txt"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-300">
                                {csvFile ? csvFile.name : 'Click or drag CSV file to upload'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Must contain headers: code, provider, denomination</p>
                        </div>

                        {csvPreview.length > 0 && (
                            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                                <div className="p-3 border-b border-slate-800 flex justify-between items-center text-sm font-semibold text-slate-300">
                                    <span>Preview Data ({csvPreview.length} codes)</span>
                                </div>
                                <div className="max-h-40 overflow-y-auto p-2">
                                    <table className="w-full text-sm text-left text-slate-400">
                                        <thead className="text-xs uppercase bg-slate-800 text-slate-500">
                                            <tr>
                                                <th className="px-4 py-2 rounded-tl-md">Code</th>
                                                <th className="px-4 py-2">Provider</th>
                                                <th className="px-4 py-2 rounded-tr-md">Denom.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvPreview.slice(0, 5).map((row, idx) => (
                                                <tr key={idx} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                                                    <td className="px-4 py-2 font-mono text-xs">{row.code.substring(0, 4)}••••{row.code.slice(-4)}</td>
                                                    <td className="px-4 py-2 capitalize">{row.provider}</td>
                                                    <td className="px-4 py-2">{row.denomination}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {csvPreview.length > 5 && (
                                        <div className="text-center p-2 text-xs text-slate-500 italic">
                                            + {csvPreview.length - 5} more rows...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-slate-800">
                            <Button 
                                onClick={handleImportSubmit} 
                                disabled={csvPreview.length === 0 || isUploadingVouchers}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                            >
                                {isUploadingVouchers ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
                                Import {csvPreview.length > 0 ? csvPreview.length : ''} Vouchers
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
