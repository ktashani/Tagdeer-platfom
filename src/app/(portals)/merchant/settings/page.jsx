"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, ShieldCheck, Mail, Phone, Lock, UserPlus, Users, Store, Crown, Building, Trash2, CheckCircle2, ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { useTagdeer } from '@/context/TagdeerContext';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MerchantSettings() {
    const { user, businesses, supabase, showToast, setUser, tierPricing = [] } = useTagdeer();
    const router = useRouter();
    const searchParams = useSearchParams();
    const trialCampaignId = searchParams.get('trial_campaign');

    // Dynamic Business Context Search
    const myBusiness = businesses?.find(b => b.owner_id === user?.id) || null;

    // Account Level
    const [accountTier, setAccountTier] = useState('Free'); // 'Free', 'Pro', 'Enterprise'
    const [subscription, setSubscription] = useState(null);
    const [quotaUsage, setQuotaUsage] = useState({ locationsUsed: 0, shieldsAssigned: 0, storefrontsAssigned: 0 });
    const [personalInfo, setPersonalInfo] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        if (user && supabase) {
            setPersonalInfo({
                name: user.full_name || '',
                email: user.email || user.profile_email || '',
                phone: user.phone || ''
            });
            // Fetch actual subscription and quota usage
            const fetchSub = async () => {
                // Fetch subscription by Merchant Profile
                const { data } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('profile_id', user.id)
                    .eq('status', 'Active')
                    .single();

                // Calculate Quota Usage and Addons
                const [bizCountRes, shieldCountRes, storefrontCountRes, addonsRes] = await Promise.all([
                    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('claimed_by', user.id),
                    supabase.from('feature_allocations').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('feature_type', 'shield').eq('status', 'active'),
                    supabase.from('feature_allocations').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('feature_type', 'storefront').eq('status', 'active'),
                    supabase.from('merchant_addons').select('addon_type, quantity').eq('profile_id', user.id).eq('status', 'active').or('expires_at.is.null,expires_at.gt.now()')
                ]);

                setQuotaUsage({
                    locationsUsed: bizCountRes.count || 0,
                    shieldsAssigned: shieldCountRes.count || 0,
                    storefrontsAssigned: storefrontCountRes.count || 0
                });

                if (data && data.tier) {
                    // Integrate Addons into dynamic computing Base Quotas
                    const computedQuotas = { ...data.quotas };
                    if (addonsRes.data) {
                        addonsRes.data.forEach(addon => {
                            const quotaKey = `max_${addon.addon_type}s`;
                            if (computedQuotas[quotaKey] !== -1) {
                                computedQuotas[quotaKey] = (computedQuotas[quotaKey] || 0) + addon.quantity;
                            }
                        });
                    }
                    data.quotas = computedQuotas;

                    setSubscription(data);

                    // Client-side expiry fallback
                    const expiresAt = new Date(data.expires_at)
                    if (expiresAt < new Date() && data.status === 'Active') {
                        await supabase
                            .from('subscriptions')
                            .update({ status: 'Expired' })
                            .eq('id', data.id)
                        setAccountTier('Free')
                        data.status = 'Expired' // Update local ref
                    } else {
                        setAccountTier(data.tier);
                    }
                } else {
                    setAccountTier('Free');
                }
            };
            fetchSub();
        }
    }, [user, supabase]);

    const handleSaveProfile = async () => {
        if (!supabase || !user) return;
        setIsSavingProfile(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: personalInfo.name,
                    email: personalInfo.email,
                    phone: personalInfo.phone
                })
                .eq('id', user.id);

            if (error) throw error;

            // Update local context manually
            setUser({ ...user, full_name: personalInfo.name, email: personalInfo.email, phone: personalInfo.phone });

            if (showToast) showToast('Profile updated successfully!');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Failed to update profile.', 'error');
        } finally {
            setIsSavingProfile(false);
        }
    };

    // --- Trial Campaign Logic ---
    const [campaignData, setCampaignData] = useState(null);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        if (trialCampaignId && supabase && myBusiness && accountTier === 'Free') {
            const fetchCampaign = async () => {
                const { data, error } = await supabase
                    .from('trial_campaigns')
                    .select('*')
                    .eq('id', trialCampaignId)
                    .single();

                if (!error && data && data.is_active && data.current_redemptions < data.max_redemptions) {
                    setCampaignData(data);
                }
            };
            fetchCampaign();
        }
    }, [trialCampaignId, supabase, myBusiness, accountTier]);

    const handleClaimTrial = async () => {
        if (!campaignData || !myBusiness || !user) return;
        setIsClaiming(true);
        try {
            const res = await fetch('/api/merchant/trial/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: myBusiness.id,
                    campaignId: campaignData.id,
                    userId: user.id
                })
            });
            const data = await res.json();

            // The API returns { success, error, message }
            if (!res.ok || (data && !data.success)) {
                const errorMessage = data?.error || 'Failed to claim trial';

                if (errorMessage.includes('already claimed') || errorMessage.includes('already redeemed')) {
                    showToast("You have already claimed this trial campaign.", "error");
                } else if (errorMessage.includes('not active') || errorMessage.includes('limit') || errorMessage.includes('expired')) {
                    showToast("This campaign has expired or reached its limit.", "error");
                } else if (errorMessage.includes('paid subscriptions')) {
                    showToast("You already have an active paid subscription.", "error");
                } else {
                    showToast(errorMessage, "error");
                }
            } else {
                showToast("Trial claimed successfully! Welcome to Premium!");
                // Remove the URL parameter cleanly
                router.replace('/merchant/settings');
                // Force a page reload to resync context and subscriptions
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to claim trial.", "error");
        } finally {
            setIsClaiming(false);
        }
    };
    // ----------------------------

    // Business Level (Contextual)
    const [businessShield, setBusinessShield] = useState(0); // 0 = None, 1 = Trust, 2 = Fatora
    const [businessStorefront, setBusinessStorefront] = useState(false);

    useEffect(() => {
        if (myBusiness && user) {
            const fetchBusinessState = async () => {
                const { data: shieldData } = await supabase
                    .from('feature_allocations')
                    .select('id')
                    .eq('business_id', myBusiness.id)
                    .eq('profile_id', user.id)
                    .eq('feature_type', 'shield')
                    .eq('status', 'active')
                    .maybeSingle();

                setBusinessShield(shieldData ? 1 : 0);

                const { data: storefrontData } = await supabase
                    .from('feature_allocations')
                    .select('id')
                    .eq('business_id', myBusiness.id)
                    .eq('profile_id', user.id)
                    .eq('feature_type', 'storefront')
                    .eq('status', 'active')
                    .maybeSingle();

                setBusinessStorefront(!!storefrontData);
            };
            fetchBusinessState();
        }
    }, [myBusiness, user]);

    const handleShieldToggle = async (level) => {
        if (!myBusiness || !supabase || !user) return;
        try {
            const activating = level > 0;

            if (activating) {
                // Check quota
                const maxShields = subscription?.quotas?.max_shields || 0;
                if (maxShields !== -1 && quotaUsage.shieldsAssigned >= maxShields) {
                    if (showToast) showToast(`You have reached your allocation limit of ${maxShields} Shields. Upgrade your Tier.`, 'error');
                    return;
                }

                const { error } = await supabase
                    .from('feature_allocations')
                    .insert({
                        profile_id: user.id,
                        business_id: myBusiness.id,
                        feature_type: 'shield',
                        status: 'active'
                    });
                if (error) {
                    if (error.code === '23505') {
                        // Already exists, just make sure it's active
                        await supabase.from('feature_allocations').update({ status: 'active' }).eq('business_id', myBusiness.id).eq('profile_id', user.id).eq('feature_type', 'shield');
                    } else throw error;
                }
                setQuotaUsage(prev => ({ ...prev, shieldsAssigned: prev.shieldsAssigned + 1 }));
            } else {
                // Revoke
                const { error } = await supabase
                    .from('feature_allocations')
                    .update({ status: 'revoked' })
                    .eq('profile_id', user.id)
                    .eq('business_id', myBusiness.id)
                    .eq('feature_type', 'shield');
                if (error) throw error;
                setQuotaUsage(prev => ({ ...prev, shieldsAssigned: Math.max(0, prev.shieldsAssigned - 1) }));
            }

            setBusinessShield(level ? 1 : 0);
            if (showToast) showToast(activating ? 'Trust Shield Allocated to this branch!' : 'Trust Shield Revoked.');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Failed to update shield settings.', 'error');
        }
    };

    const handleStorefrontToggle = async (isEnabled) => {
        if (!myBusiness || !supabase || !user) return;
        try {
            if (isEnabled) {
                // Check quota
                const maxStorefronts = subscription?.quotas?.max_storefronts || 0;
                if (maxStorefronts !== -1 && quotaUsage.storefrontsAssigned >= maxStorefronts) {
                    if (showToast) showToast(`You have reached your allocation limit of ${maxStorefronts} Storefronts. Upgrade your Tier.`, 'error');
                    return;
                }

                const { error } = await supabase
                    .from('feature_allocations')
                    .insert({
                        profile_id: user.id,
                        business_id: myBusiness.id,
                        feature_type: 'storefront',
                        status: 'active'
                    });
                if (error) {
                    if (error.code === '23505') {
                        await supabase.from('feature_allocations').update({ status: 'active' }).eq('business_id', myBusiness.id).eq('profile_id', user.id).eq('feature_type', 'storefront');
                    } else throw error;
                }
                setQuotaUsage(prev => ({ ...prev, storefrontsAssigned: prev.storefrontsAssigned + 1 }));
            } else {
                // Revoke
                const { error } = await supabase
                    .from('feature_allocations')
                    .update({ status: 'revoked' })
                    .eq('profile_id', user.id)
                    .eq('business_id', myBusiness.id)
                    .eq('feature_type', 'storefront');
                if (error) throw error;
                // Deactivate the actual storefront if it exists
                await supabase.from('storefronts').update({ status: 'archived' }).eq('business_id', myBusiness.id);
                setQuotaUsage(prev => ({ ...prev, storefrontsAssigned: Math.max(0, prev.storefrontsAssigned - 1) }));
            }

            setBusinessStorefront(isEnabled);
            if (showToast) showToast(isEnabled ? 'Storefront Enabled for this branch!' : 'Storefront Disabled.');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Failed to update storefront settings.', 'error');
        }
    };

    const handlePasswordReset = async () => {
        if (!supabase || !user?.email) return;
        try {
            const redirectUrl = `${window.location.origin}/auth/callback?next=/merchant/reset-password&from=merchant`;
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: redirectUrl,
            });
            if (error) throw error;
            if (showToast) showToast('Password reset link sent to your email!');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Failed to send reset link.', 'error');
        }
    };

    // Team Management
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);

    useEffect(() => {
        if (!supabase || !myBusiness || accountTier === 'Free') return;
        const fetchTeam = async () => {
            setIsLoadingTeam(true);
            try {
                const { data, error } = await supabase
                    .from('business_team_members')
                    .select('id, role, created_at, profile_id, profiles:profiles!business_team_members_profile_id_fkey(full_name, email, phone)')
                    .eq('business_id', myBusiness.id);

                if (error) throw error;

                const members = [
                    { id: user.id, email: user.email || user.profile_email || '', name: user.full_name || '', role: 'Owner', access: 'All Businesses', isOwner: true },
                    ...(data || []).map(m => ({
                        id: m.id,
                        profileId: m.profile_id,
                        email: m.profiles?.email || '',
                        name: m.profiles?.full_name || '',
                        role: m.role === 'manager' ? 'Manager' : 'Cashier',
                        access: myBusiness?.name || 'Business',
                        isOwner: false
                    }))
                ];
                setTeamMembers(members);
            } catch (err) {
                console.error('Failed to fetch team:', err);
                // Fallback to owner-only
                setTeamMembers([
                    { id: user.id, email: user.email || user.profile_email || '', name: user.full_name || '', role: 'Owner', access: 'All Businesses', isOwner: true }
                ]);
            } finally {
                setIsLoadingTeam(false);
            }
        };
        fetchTeam();
    }, [supabase, myBusiness, accountTier, user]);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('cashier');
    const [isInviting, setIsInviting] = useState(false);

    const handleInviteMember = async () => {
        if (!inviteEmail.trim() || !supabase || !myBusiness) return;
        setIsInviting(true);
        try {
            // 1. Look up the profile by email
            const { data: profile, error: lookupErr } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('email', inviteEmail.trim().toLowerCase())
                .single();

            if (lookupErr || !profile) {
                showToast('No Tagdeer account found with that email. Ask them to sign up first.');
                return;
            }

            if (profile.id === user.id) {
                showToast('You cannot invite yourself!');
                return;
            }

            // 2. Insert into business_team_members
            const { error: insertErr } = await supabase
                .from('business_team_members')
                .insert([{
                    business_id: myBusiness.id,
                    profile_id: profile.id,
                    role: inviteRole,
                    invited_by: user.id
                }]);

            if (insertErr) {
                if (insertErr.code === '23505') {
                    showToast('This person is already on your team!');
                } else {
                    throw insertErr;
                }
                return;
            }

            // 3. Add to local state
            setTeamMembers(prev => [...prev, {
                id: Date.now().toString(),
                profileId: profile.id,
                email: profile.email,
                name: profile.full_name || '',
                role: inviteRole === 'manager' ? 'Manager' : 'Cashier',
                access: myBusiness?.name || 'Business',
                isOwner: false
            }]);

            setInviteEmail('');
            showToast(`${profile.full_name || profile.email} added to your team!`);
        } catch (err) {
            console.error('Invite error:', err);
            showToast('Failed to invite team member.');
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemoveMember = async (member) => {
        if (!supabase || !member.profileId) return;
        try {
            const { error } = await supabase
                .from('business_team_members')
                .delete()
                .eq('business_id', myBusiness.id)
                .eq('profile_id', member.profileId);

            if (error) throw error;

            setTeamMembers(prev => prev.filter(m => m.profileId !== member.profileId));
            showToast(`${member.name || member.email} removed from your team.`);
        } catch (err) {
            console.error('Remove error:', err);
            showToast('Failed to remove team member.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 xl:p-8">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                            Platform Settings
                            {accountTier === 'Free' && <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Free Tier</Badge>}
                            {accountTier === 'Pro' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-none shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" /> Pro Tier</Badge>}
                            {accountTier === 'Enterprise' && <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 border-none text-white shadow-md shadow-purple-500/20"><Crown className="w-3 h-3 mr-1" /> Enterprise Tier</Badge>}
                        </h1>
                        <p className="text-slate-500 mt-1">Manage your personal account, business features, and team access.</p>
                    </div>
                </div>

                {/* Main Settings Layout */}
                <Tabs defaultValue="account" className="flex flex-col lg:flex-row gap-8">

                    {/* Vertical Sidebar Navigation */}
                    <TabsList className="flex flex-col w-full lg:w-64 h-auto bg-transparent p-0 gap-2 justify-start items-start">
                        <TabsTrigger
                            value="account"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium"
                        >
                            <Users className="w-4 h-4 mr-3 opacity-70" /> Account Details
                        </TabsTrigger>
                        <TabsTrigger
                            value="business"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium"
                        >
                            <Store className="w-4 h-4 mr-3 opacity-70" /> Business Settings
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium relative"
                        >
                            <UserPlus className="w-4 h-4 mr-3 opacity-70" /> Team Management
                            {accountTier === 'Free' && <Lock className="w-3 h-3 absolute right-4 text-slate-400" />}
                        </TabsTrigger>
                    </TabsList>

                    {/* Content Area */}
                    <div className="flex-1 w-full min-w-0">

                        {/* ==========================================
                            TAB 1: ACCOUNT DETAILS (GLOBAL)
                        ========================================== */}
                        <TabsContent value="account" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            {/* Trial Campaign Banner */}
                            {campaignData && accountTier === 'Free' && (
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-1 shadow-xl animate-in zoom-in-95 duration-500">
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                        <div className="relative z-10 flex-1">
                                            <div className="flex items-center gap-2 text-indigo-500 font-bold mb-2">
                                                <Sparkles className="w-5 h-5" /> Special Invitation
                                            </div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                                                Claim your {campaignData.trial_months}-Month {campaignData.tier} Trial
                                            </h2>
                                            <p className="text-slate-500 dark:text-slate-400">
                                                You've been invited via <strong>{campaignData.name}</strong> to experience the Tagdeer Platform risk-free. Hurry, only {campaignData.max_redemptions - campaignData.current_redemptions} spots left!
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleClaimTrial}
                                            disabled={isClaiming}
                                            size="lg"
                                            className="w-full md:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-14 px-8 rounded-xl shadow-lg shadow-indigo-500/30"
                                        >
                                            {isClaiming ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                            Claim {campaignData.tier} Trial Now
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Tier Subscription Card */}
                            <Card className={`overflow-hidden transition-colors ${accountTier === 'Enterprise' ? 'border-purple-500/50 bg-purple-50/30 dark:bg-purple-950/20' : ''}`}>
                                <div className={`h-1.5 w-full ${accountTier === 'Free' ? 'bg-slate-200 dark:bg-slate-800' : accountTier === 'Pro' ? 'bg-blue-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`} />
                                <CardHeader className="pb-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-xl">
                                            Merchant Subscription Tier
                                            {accountTier === 'Enterprise' && <Crown className="w-5 h-5 text-purple-500" />}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Determines your global platform capabilities, loyalty campaigns, and team size.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className={`grid grid-cols-1 ${tierPricing.length === 1 ? 'max-w-md' : tierPricing.length === 2 ? 'max-w-2xl' : 'grid-cols-1 lg:grid-cols-3'} gap-4`}>
                                        {tierPricing.map((tier) => {
                                            const isActiveTier = accountTier?.toLowerCase() === tier.id?.toLowerCase() || accountTier?.toLowerCase() === tier.name?.toLowerCase();
                                            const isEnterprise = tier.id?.toLowerCase().includes('enterprise');
                                            const isPro = tier.id?.toLowerCase().includes('pro');

                                            return (
                                                <div
                                                    key={tier.id}
                                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col ${isActiveTier
                                                        ? (isEnterprise ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : isPro ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-400 bg-slate-50 dark:bg-slate-900/50')
                                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h3 className="font-bold flex items-center gap-2">
                                                                {isEnterprise && <Crown className="w-4 h-4 text-purple-500" />}
                                                                {tier.name}
                                                            </h3>
                                                            <p className={`text-sm font-semibold ${isEnterprise ? 'text-purple-600' : isPro ? 'text-blue-600' : 'text-slate-500'}`}>
                                                                {tier.price} LYD / month
                                                            </p>
                                                        </div>
                                                        {isActiveTier && <CheckCircle2 className={`w-5 h-5 ${isEnterprise ? 'text-purple-600' : isPro ? 'text-blue-600' : 'text-slate-600'}`} />}
                                                    </div>
                                                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-4 flex-1">
                                                        {tier.features?.map((feature, fIdx) => (
                                                            <li key={fIdx} className="flex items-center gap-2">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {feature}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    {!isActiveTier && (
                                                        <Button
                                                            variant={isPro ? "default" : "outline"}
                                                            size="sm"
                                                            className={`w-full mt-4 ${isEnterprise
                                                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-lg shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700'
                                                                : isPro ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            Upgrade to {tier.name}
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Merchant Quota Usage Dashboard */}
                            <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                                <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900 pb-4">
                                    <CardTitle>My Plan & Allocations</CardTitle>
                                    <CardDescription>Track the features and resources available across all your businesses.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                        {/* Locations Quota */}
                                        <div className="space-y-3 p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <Store className="w-5 h-5 text-indigo-500" /> Managed Locations
                                                </div>
                                                <span className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {quotaUsage.locationsUsed} / {subscription?.quotas?.max_locations || 1}
                                                </span>
                                            </div>
                                            <Progress value={(quotaUsage.locationsUsed / (subscription?.quotas?.max_locations || 1)) * 100} className="h-2 bg-slate-100" indicatorClassName={quotaUsage.locationsUsed >= (subscription?.quotas?.max_locations || 1) ? 'bg-amber-500' : 'bg-indigo-500'} />
                                            <p className="text-xs text-slate-500">Upgrade your tier to manage more business branches.</p>
                                        </div>

                                        {/* Shields Quota */}
                                        <div className="space-y-3 p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <ShieldCheck className="w-5 h-5 text-emerald-500" /> Trust Shields
                                                </div>
                                                <span className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {subscription?.quotas?.max_shields === -1 ? 'Unlimited' : `${quotaUsage.shieldsAssigned} / ${subscription?.quotas?.max_shields || 0}`}
                                                </span>
                                            </div>
                                            <Progress value={subscription?.quotas?.max_shields === -1 ? 100 : subscription?.quotas?.max_shields ? (quotaUsage.shieldsAssigned / subscription.quotas.max_shields) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName={subscription?.quotas?.max_shields === -1 ? 'bg-emerald-500' : quotaUsage.shieldsAssigned >= (subscription?.quotas?.max_shields || 0) ? 'bg-amber-500' : 'bg-emerald-500'} />
                                            <p className="text-xs text-slate-500">Allocate shields to your branches globally.</p>
                                        </div>

                                        {/* Storefronts Quota */}
                                        <div className="space-y-3 p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <Store className="w-5 h-5 text-purple-500" /> Live Storefronts
                                                </div>
                                                <span className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {subscription?.quotas?.max_storefronts === -1 ? 'Unlimited' : `${quotaUsage.storefrontsAssigned} / ${subscription?.quotas?.max_storefronts || 0}`}
                                                </span>
                                            </div>
                                            <Progress value={subscription?.quotas?.max_storefronts === -1 ? 100 : subscription?.quotas?.max_storefronts ? (quotaUsage.storefrontsAssigned / subscription.quotas.max_storefronts) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName={subscription?.quotas?.max_storefronts === -1 ? 'bg-purple-500' : quotaUsage.storefrontsAssigned >= (subscription?.quotas?.max_storefronts || 0) ? 'bg-amber-500' : 'bg-purple-500'} />
                                            <p className="text-xs text-slate-500">Number of active public microsites allowed.</p>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>

                            {/* Personal Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                    <CardDescription>Details associated with your merchant login.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={personalInfo.name} onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email Address</Label>
                                            <div className="relative flex items-center">
                                                <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9 bg-slate-50 dark:bg-slate-900" value={personalInfo.email} onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone Number</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9" value={personalInfo.phone} onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                                        {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Save Identity Changes
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Security */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Security</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                                                <Lock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">Password</p>
                                                <p className="text-sm text-slate-500">Last changed 3 months ago</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" onClick={handlePasswordReset}>Reset Password</Button>
                                    </div>
                                </CardContent>
                            </Card>

                        </TabsContent>

                        {/* ==========================================
                            TAB 2: BUSINESS SETTINGS (CONTEXTUAL)
                        ========================================== */}
                        <TabsContent value="business" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex items-center gap-3">
                                <Building className="w-5 h-5 text-indigo-600" />
                                <p className="text-sm text-indigo-900 dark:text-indigo-200">
                                    Currently configuring settings for: <strong className="font-bold">{myBusiness?.name || 'Your Business'}</strong>
                                </p>
                            </div>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5 text-indigo-600" />
                                        <CardTitle>Shield Subscriptions (Per-Business)</CardTitle>
                                    </div>
                                    <CardDescription>Filter out fake reviews and enable the Dispute Manager for this specific location.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Shield 1 */}
                                    <div className={`p-5 rounded-xl border-2 transition-all ${businessShield >= 1 ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${businessShield >= 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    <ShieldCheck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Trust Shield
                                                        <Badge variant="outline" className="text-xs">Level 1</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md">Forces all incoming interactions to originate from SMS-verified accounts.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={businessShield >= 1}
                                                onCheckedChange={(c) => handleShieldToggle(c ? (businessShield === 2 ? 2 : 1) : 0)}
                                                className="data-[state=checked]:bg-amber-500 shrink-0"
                                            />
                                        </div>
                                    </div>

                                    {/* Shield 2 */}
                                    <div className={`p-5 rounded-xl border-2 transition-all ${businessShield === 2 ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${businessShield === 2 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    <ShieldAlert className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Fatora Shield
                                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0">Level 2</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md">Requires physical receipt uploads for complaints. Unlocks the <strong className="text-slate-700 dark:text-slate-300">Dispute Manager</strong>.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={businessShield === 2}
                                                onCheckedChange={(c) => handleShieldToggle(c ? 2 : 1)}
                                                disabled={businessShield === 0}
                                                className="data-[state=checked]:bg-blue-600 shrink-0"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Business Features</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={`p-5 rounded-xl border-2 transition-all ${businessStorefront ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${businessStorefront ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    <Store className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-lg flex items-center gap-2">
                                                        Digital Storefront
                                                        {businessStorefront && <Badge variant="outline" className="bg-purple-100 text-purple-700 border-0">Live & Configured</Badge>}
                                                    </h4>
                                                    <p className="text-sm text-slate-500 max-w-md">Launch a personalized SEO-optimized Microsite for this branch with menus and quick links.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                {businessStorefront && (
                                                    <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => router.push(`/merchant/storefront-builder/${myBusiness?.id}`)}>
                                                        <Sparkles className="w-4 h-4 mr-2" /> Open Builder
                                                    </Button>
                                                )}
                                                <Switch checked={businessStorefront} onCheckedChange={handleStorefrontToggle} className="data-[state=checked]:bg-purple-600" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </TabsContent>

                        {/* ==========================================
                            TAB 3: TEAM MANAGEMENT (TIER 2 ONLY)
                        ========================================== */}
                        <TabsContent value="team" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            {accountTier === 'Free' ? (
                                <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20 text-center py-12">
                                    <CardContent className="flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-full flex items-center justify-center">
                                            <Users className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold">Team Management Locked</h3>
                                            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                                Upgrade your account to Pro or Enterprise to invite cashiers, managers, and staff to run your businesses.
                                            </p>
                                        </div>
                                        <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700">
                                            Unlock with Pro
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Invite Team Member</CardTitle>
                                            <CardDescription>Send an email invitation. They will need to create a Tagdeer account if they don't have one.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <Label>Email Address</Label>
                                                    <Input placeholder="manager@company.ly" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                                </div>
                                                <div className="sm:w-1/4 space-y-2">
                                                    <Label>Role</Label>
                                                    <select
                                                        value={inviteRole}
                                                        onChange={(e) => setInviteRole(e.target.value)}
                                                        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
                                                    >
                                                        <option value="cashier">Cashier</option>
                                                        <option value="manager">Manager</option>
                                                    </select>
                                                </div>
                                                <div className="sm:w-1/4 space-y-2">
                                                    <Label>Scope</Label>
                                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300">
                                                        <option>{myBusiness?.name || 'Your Business'}</option>
                                                        <option>All Businesses</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <Button
                                                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                                                        onClick={handleInviteMember}
                                                        disabled={isInviting || !inviteEmail.trim()}
                                                    >
                                                        {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                        Send Invite
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Active Members</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                                                {teamMembers.map(member => (
                                                    <div key={member.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-950">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                                                {(member.name || member.email).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">{member.name || member.email}</p>
                                                                {member.name && <p className="text-xs text-slate-500">{member.email}</p>}
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <Badge variant="outline" className="text-[10px] h-5">{member.role}</Badge>
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1"><Store className="w-3 h-3" /> {member.access}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!member.isOwner && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                onClick={() => handleRemoveMember(member)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                    </div>
                </Tabs>

            </div>
        </div>
    );
}
