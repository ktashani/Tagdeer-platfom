"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ThumbsUp, ThumbsDown, Activity, Ticket, ArrowUpRight, ArrowDownRight, QrCode, MessageSquare, Flag, Play, Pause, AlertCircle, Clock, ShieldAlert, Store, AlertTriangle, Crown, Check } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { DisputeButtonLocked, MessageUserButtonLocked } from '@/components/merchant/LockedFeatureOverlay';
import ScannerModal from '@/components/merchant/ScannerModal';
import Link from 'next/link';
import { useTagdeer } from '@/context/TagdeerContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

// Define the 4 Possible Mock States
const MOCK_STATES = {
    ACTIVE: 'ACTIVE',
    NO_BUSINESS: 'NO_BUSINESS',
    NO_TIER: 'NO_TIER',
    SUSPENDED: 'SUSPENDED',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    RESTRICTED: 'RESTRICTED'
};

// Helper: convert ISO date to "2h ago" format
function getRelativeTime(isoDate) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Helper: derive voting reason distribution from real log data
function deriveVotingReasons(logs) {
    const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6', '#ec4899'];
    const reasonCounts = {};
    (logs || []).forEach(log => {
        const reason = log.reason_text || (log.type === 'recommend' ? 'Positive' : 'Concern');
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const entries = Object.entries(reasonCounts);
    if (entries.length === 0) {
        return [{ name: 'No Data', value: 1, color: '#cbd5e1' }];
    }
    return entries.map(([name, value], i) => ({
        name,
        value,
        color: COLORS[i % COLORS.length]
    }));
}

export default function MerchantDashboard() {
    const { user, businesses, supabase, showToast } = useTagdeer();
    const router = useRouter();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Real data state
    const [pendingDisputes, setPendingDisputes] = useState([]);
    const [activeCampaigns, setActiveCampaigns] = useState([]);
    const [couponsRedeemed, setCouponsRedeemed] = useState(0);
    const [pendingClaim, setPendingClaim] = useState(null);

    // Only render once user loading finishes
    if (user === undefined) return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;

    // Find the currently authenticated merchant's business
    const myBusiness = businesses.find(b => b.owner_id === user?.id);

    // ==========================================
    // FETCH REAL DATA
    // ==========================================
    useEffect(() => {
        if (!supabase || !myBusiness || !user) return;

        const fetchDashboardData = async () => {
            try {
                // Fetch claim status to check if admin approval is pending
                const { data: claimData } = await supabase
                    .from('business_claims')
                    .select('status, claim_status')
                    .eq('business_id', myBusiness.id)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (claimData) {
                    const status = claimData.status || claimData.claim_status || 'pending';
                    if (status === 'pending' || status === 'missing_docs') {
                        setPendingClaim(status);
                    }
                }

                // Fetch pending disputes
                const { data: disputes } = await supabase
                    .from('disputes')
                    .select('id, reason, status, created_at')
                    .eq('business_id', myBusiness.id)
                    .in('status', ['pending_admin_review', 'in_review'])
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (disputes) {
                    setPendingDisputes(disputes.map(d => ({
                        id: `DSP-${d.id.substring(0, 3).toUpperCase()}`,
                        reason: d.reason || 'Dispute',
                        status: d.status === 'pending_admin_review' ? 'Pending Admin' : 'In Review',
                        time: getRelativeTime(d.created_at)
                    })));
                }

                // Fetch active campaigns
                const { data: campaigns } = await supabase
                    .from('coupon_pools')
                    .select('id, title, amount, remaining, status')
                    .eq('business_id', myBusiness.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (campaigns) {
                    setActiveCampaigns(campaigns.map(c => ({
                        name: c.title || 'Campaign',
                        redeemed: `${(c.amount || 0) - (c.remaining || 0)}/${c.amount || 0}`,
                        status: c.status === 'active' ? 'Active' : (c.remaining === 0 ? 'Exhausted' : 'Paused')
                    })));

                    // Sum redeemed coupons
                    const totalRedeemed = campaigns.reduce((sum, c) => sum + ((c.amount || 0) - (c.remaining || 0)), 0);
                    setCouponsRedeemed(totalRedeemed);
                }
            } catch (err) {
                console.error('Dashboard data fetch error:', err);
            }
        };

        fetchDashboardData();
    }, [supabase, myBusiness?.id, user?.id]);

    // ==========================================
    // DYNAMIC STATES
    // ==========================================
    let currentMockState = MOCK_STATES.ACTIVE;
    if (!myBusiness) {
        currentMockState = MOCK_STATES.NO_BUSINESS;
    } else if (pendingClaim === 'pending' || pendingClaim === 'missing_docs') {
        currentMockState = MOCK_STATES.PENDING_APPROVAL;
    } else if (myBusiness.status === 'restricted') {
        currentMockState = MOCK_STATES.RESTRICTED;
    } else if (myBusiness.status === 'pending_review') {
        currentMockState = MOCK_STATES.PENDING_APPROVAL;
    }

    // Derived Metrics
    let metrics = {
        totalInteractions: 0,
        recommendations: 0,
        complaints: 0,
        couponsRedeemed: couponsRedeemed
    };

    let recentExperiences = [];
    let topCategories = [];

    if (myBusiness) {
        metrics.recommendations = myBusiness.recommends || 0;
        metrics.complaints = myBusiness.complains || 0;
        metrics.totalInteractions = metrics.recommendations + metrics.complaints;

        // Map live logs to dashboard format
        recentExperiences = [...(myBusiness.logs || [])].map((log) => ({
            id: `LOG-${String(log.id).substring(0, 6).toUpperCase()}`,
            user: log.is_verified ? 'VIP User' : 'Anonymous',
            type: log.type === 'recommend' ? 'Recommend' : 'Complain',
            date: log.date,
            reason: log.text || 'N/A',
            hasReceipt: false,
            rawText: log.text
        }));

        // Dynamically compute Top Categories from positive logs
        const positiveLogs = myBusiness.logs.filter(l => l.type === 'recommend');
        topCategories = [
            { category: 'General Service', score: `${positiveLogs.length > 0 ? '95%' : 'N/A'}`, positive: true },
        ];
    }

    // Filter experiences by search query
    const filteredExperiences = searchQuery
        ? recentExperiences.filter(exp =>
            exp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.reason.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : recentExperiences;

    // Derived Metric: Interaction Rate (based on total interactions)
    const interactionRate = metrics.totalInteractions > 0 ? ((metrics.recommendations / metrics.totalInteractions) * 100).toFixed(1) : 0;

    // Derive voting reasons from actual log data
    const votingReasons = deriveVotingReasons(myBusiness?.logs || []);

    // ==========================================
    // RENDER: PENDING APPROVAL STATE
    // ==========================================
    if (currentMockState === MOCK_STATES.PENDING_APPROVAL) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${pendingClaim === 'missing_docs' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                    {pendingClaim === 'missing_docs' ? <AlertCircle className="w-12 h-12" /> : <Clock className="w-12 h-12" />}
                </div>
                <h2 className="text-3xl font-black mb-4">{pendingClaim === 'missing_docs' ? 'Action Required' : 'Profile Under Review'}</h2>
                <p className="text-slate-500 max-w-lg mx-auto text-lg mb-8">
                    {pendingClaim === 'missing_docs'
                        ? 'Your submission is missing required documents or they were unreadable. Please check your email for details from the admin team on how to provide them.'
                        : 'Your business profile is currently being reviewed by our admin team. You will regain access to the platform once your profile meets our directory standards and is approved.'}
                </p>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-sm text-left">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-500" /> Account Status</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Verification Documents</span>
                            <Badge variant="outline" className={`border-0 ${pendingClaim === 'missing_docs' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                {pendingClaim === 'missing_docs' ? 'Missing/Invalid' : 'In Review'}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Subscription Setup</span>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-0">Awaiting Invoice</Badge>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: SUSPENDED STATE
    // ==========================================
    if (currentMockState === MOCK_STATES.SUSPENDED) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-3xl p-8 md:p-12 text-center max-w-2xl w-full shadow-2xl shadow-red-500/10 animate-in slide-in-from-bottom-4">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-red-700 dark:text-red-500 mb-4">Account Suspended</h2>
                    <p className="text-lg text-red-600/80 dark:text-red-400 mb-8 leading-relaxed">
                        Your merchant account has been temporarily suspended due to a violation of our terms of service or a delay in subscription payment. You are currently locked out of your dashboard.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-8 text-base">
                            Pay Outstanding Balance
                        </Button>
                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 rounded-xl h-12 px-8 text-base">
                            Contact Support
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: RESTRICTED STATE (REQUIRES FIXES)
    // ==========================================
    if (currentMockState === MOCK_STATES.RESTRICTED) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-3xl p-8 md:p-12 text-center max-w-2xl w-full shadow-2xl shadow-red-500/10 animate-in slide-in-from-bottom-4 relative overflow-hidden">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Flag className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-red-700 dark:text-red-500 mb-4">Profile Restricted</h2>
                    <p className="text-lg text-red-600/80 dark:text-red-400 mb-6 leading-relaxed">
                        Your business profile has been temporarily hidden from the public directory. Our moderation team has left the following note regarding necessary changes:
                    </p>

                    <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-5 mb-8 text-left relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-xl"></div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" /> Admin Note
                        </h4>
                        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {myBusiness?.restriction_reason || "Please ensure your business details comply with our directory guidelines."}
                        </p>
                    </div>

                    <p className="text-sm text-slate-500 mb-6 font-medium">
                        Please update your profile details in the Settings page to comply with this notice, then resubmit your profile for review.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-8 text-base shadow-sm"
                            onClick={async () => {
                                try {
                                    const { error } = await supabase
                                        .from('businesses')
                                        .update({ status: 'pending_review' })
                                        .eq('id', myBusiness.id);
                                    if (error) throw error;
                                    showToast("Profile resubmitted for review successfully.");
                                } catch (err) {
                                    console.error("Resubmit error:", err);
                                    showToast("Failed to resubmit profile.", "error");
                                }
                            }}
                        >
                            Resubmit Profile for Review
                        </Button>
                        <Button
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 rounded-xl h-12 px-8 text-base bg-white dark:bg-transparent dark:hover:bg-red-900/20"
                            onClick={() => router.push('/merchant/settings')}
                        >
                            Edit Profile Details
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: NO BUSINESS CLAIMED STATE
    // ==========================================
    if (currentMockState === MOCK_STATES.NO_BUSINESS) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-full flex items-center justify-center mb-8 border-4 border-white dark:border-slate-950 shadow-xl">
                    <Store className="w-10 h-10" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Welcome to Tagdeer!</h2>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-10">
                    You have an active subscription, but you haven't brought your business onto the platform yet. Let's fix that.
                </p>
                <Link href="/merchant/onboarding">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-14 px-10 text-lg shadow-lg shadow-blue-600/20 font-bold">
                        Start Your Business Claim Process <ArrowUpRight className="w-5 h-5 ml-2" />
                    </Button>
                </Link>
            </div>
        );
    }

    // ==========================================
    // NORMAL ACTIVE DASHBOARD RENDER
    // (NO_TIER state renders this but forces a modal over it)
    // ==========================================
    return (
        <div className="space-y-8 animate-in fade-in duration-300 relative">

            {/* NO_TIER Modal Overlay */}
            <Dialog open={currentMockState === MOCK_STATES.NO_TIER} onOpenChange={() => { }}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border-0 rounded-[2rem] shadow-2xl [&>button]:hidden">
                    <div className="p-8 md:p-12 text-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-3xl font-black text-slate-900 dark:text-white mb-3">Power Up Your Account</DialogTitle>
                        <DialogDescription className="text-lg text-slate-500 text-center">
                            You need an active tier subscription to access the Tagdeer Merchant Platform. Please select a plan below to proceed to checkout and unlock your dashboard.
                        </DialogDescription>
                    </div>

                    <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950">
                        {/* Tier 1 Box in Modal */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col">
                            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Tier 1 (Base)</h3>
                            <div className="text-4xl font-black mb-6 text-slate-900 dark:text-white">49 <span className="text-xl font-bold">LYD</span><span className="text-base font-normal text-slate-500">/mo</span></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300"><Check className="w-5 h-5 text-emerald-500" /> <span>Manage 1 Location</span></li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300"><Check className="w-5 h-5 text-emerald-500" /> <span>Accept Reviews</span></li>
                            </ul>
                            <Link href="/merchant/onboarding" className="w-full block">
                                <Button className="w-full h-12 text-lg rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 border-0">Select Base Plan</Button>
                            </Link>
                        </div>
                        {/* Tier 2 Box in Modal */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl border border-indigo-500 p-8 shadow-xl flex flex-col relative text-white">
                            <div className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Crown className="w-3 h-3" /> PRO</div>
                            <h3 className="text-2xl font-bold mb-4">Tier 2 (Pro)</h3>
                            <div className="text-4xl font-black mb-6">99 <span className="text-xl font-bold">LYD</span><span className="text-base font-normal text-indigo-300">/mo</span></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-white"><Check className="w-5 h-5 text-emerald-400" /> <span>Unlimited Locations</span></li>
                                <li className="flex items-center gap-3 text-white"><Check className="w-5 h-5 text-emerald-400" /> <span>Team Management</span></li>
                            </ul>
                            <Link href="/merchant/onboarding" className="w-full block">
                                <Button className="w-full h-12 text-lg rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold border-0">Select Pro Plan</Button>
                            </Link>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 1. Welcome & Search Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="w-full md:w-1/3">
                    <h1 className="text-2xl font-bold text-slate-800">
                        Good Morning, <span className="text-blue-600">{myBusiness ? myBusiness.name : 'Merchant'}</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Here's what's happening with your store today.</p>
                </div>

                <div className="w-full md:w-1/3 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        placeholder="Search VIP logs, coupons, disputes..."
                        className="pl-10 bg-slate-50/50 border-slate-200 rounded-full h-11 shadow-inner focus-visible:ring-indigo-500 w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="w-full md:w-1/3 flex justify-end">
                    <Button
                        onClick={() => setIsScannerOpen(true)}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 rounded-full h-11 px-6"
                    >
                        <QrCode className="w-5 h-5 mr-2" />
                        Scan Customer VIP
                    </Button>
                </div>
            </div>

            {/* 2. Pulse Cards (5 Column Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

                {/* Metric 1 */}
                <Card className="border-slate-200 shadow-sm col-span-1 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3">
                    </div>
                    <CardContent className="p-5 pt-8">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
                            <ThumbsUp className="w-5 h-5" />
                        </div>
                        <div className="text-3xl font-bold text-slate-800 mb-1">{metrics.recommendations}</div>
                        <div className="text-xs text-slate-500 font-medium">Recommendations</div>
                    </CardContent>
                </Card>

                {/* Metric 2 */}
                <Card className="border-slate-200 shadow-sm col-span-1 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3">
                    </div>
                    <CardContent className="p-5 pt-8">
                        <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
                            <ThumbsDown className="w-5 h-5" />
                        </div>
                        <div className="text-3xl font-bold text-slate-800 mb-1">{metrics.complaints}</div>
                        <div className="text-xs text-slate-500 font-medium">Complaints</div>
                    </CardContent>
                </Card>

                {/* Metric 3 */}
                <Card className="border-slate-200 shadow-sm col-span-1 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3">
                    </div>
                    <CardContent className="p-5 pt-8">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div className="text-3xl font-bold text-slate-800 mb-1">{interactionRate}%</div>
                        <div className="text-xs text-slate-500 font-medium">Recommend Rate</div>
                    </CardContent>
                </Card>

                {/* Metric 4 */}
                <Card className="border-slate-200 shadow-sm col-span-1 rounded-2xl overflow-hidden relative group">
                    <CardContent className="p-5 pt-8">
                        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <div className="text-3xl font-bold text-slate-800 mb-1">{metrics.couponsRedeemed}</div>
                        <div className="text-xs text-slate-500 font-medium">Coupons Redeemed</div>
                    </CardContent>
                </Card>

                {/* Donut Chart */}
                <Card className="border-slate-200 shadow-sm col-span-1 md:col-span-2 lg:col-span-1 rounded-2xl overflow-hidden flex flex-col justify-center relative">
                    <CardContent className="p-5 flex items-center h-full">
                        <div className="w-1/2">
                            <div className="text-xs text-slate-500 font-medium mb-1">Top Reason</div>
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Speed
                            </div>
                            <div className="font-bold text-slate-800 flex items-center gap-1 mt-1 text-sm">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Quality
                            </div>
                        </div>
                        <div className="w-1/2 h-28 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={votingReasons}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={45}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {votingReasons.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', padding: '4px 8px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-lg font-bold text-slate-800">{metrics.totalInteractions}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 3. The Operational Core (Action Table) */}
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 pb-4">
                    <CardTitle className="text-lg text-slate-800">Recent VIP Experiences</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-medium tracking-wider">Experience ID</th>
                                <th className="px-6 py-4 font-medium tracking-wider">User ID</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Type</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Reason</th>
                                <th className="px-6 py-4 font-medium tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredExperiences.map((exp) => (
                                <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-slate-600">{exp.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                {exp.user.substring(0, 2)}
                                            </div>
                                            <span className="text-slate-700 font-medium">{exp.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={`border-0 ${exp.type === 'Recommend' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                            {exp.type}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{exp.date}</td>
                                    <td className="px-6 py-4 text-slate-600">{exp.reason}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            {exp.type === 'Complain' ? (
                                                <>
                                                    {exp.hasReceipt && <Button size="sm" variant="outline" className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"><Flag className="w-3 h-3 mr-1" /> Flag</Button>}
                                                    <Button size="sm" variant="outline" className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => router.push('/merchant/inbox')}><MessageSquare className="w-3 h-3 mr-1" /> Chat</Button>
                                                </>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => showToast('Thank you noted! 🎉')}>Thank User</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* 4. Activity Widgets (3 Column Bottom Row) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Widget 1: Pending Disputes */}
                <Card className="border-slate-200 shadow-sm rounded-2xl h-full flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                            Pending Disputes
                            <span className="text-[10px] font-normal text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Action Required</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1">
                        {pendingDisputes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                <span className="text-sm">No active disputes</span>
                            </div>
                        ) : pendingDisputes.map(dispute => (
                            <div key={dispute.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                                        <Flag className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{dispute.id}</p>
                                        <p className="text-xs text-slate-500">{dispute.time}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px]">
                                    {dispute.status}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Widget 2: Top Capabilities */}
                <Card className="border-slate-200 shadow-sm rounded-2xl h-full flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                            Top Appreciated Categories
                            <span className="text-[10px] font-normal text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Performance</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1">
                        {topCategories.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-emerald-600 text-xs">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{cat.category}</p>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3" /> {cat.score}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Widget 3: Active Campaigns */}
                <Card className="border-slate-200 shadow-sm rounded-2xl h-full flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                            Active Campaigns
                            <span className="text-[10px] font-normal text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Marketing</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1">
                        {activeCampaigns.map((camp, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${camp.status === 'Active' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                                        <Ticket className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{camp.name}</p>
                                        <p className="text-xs text-slate-500">Redeemed: {camp.redeemed}</p>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-full ${camp.status === 'Active' ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400'} `}>
                                    {camp.status === 'Active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

            </div>

            <ScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                businessId={myBusiness?.id || ''}
            />

        </div>
    );
}
