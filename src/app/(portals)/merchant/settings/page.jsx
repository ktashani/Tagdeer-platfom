"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, ShieldCheck, Mail, Phone, Lock, UserPlus, Users, Store, Crown, Building, Trash2, CheckCircle2, ArrowUpRight, Loader2 } from "lucide-react";
import { useTagdeer } from '@/context/TagdeerContext';

export default function MerchantSettings() {
    const { user, businesses, supabase, showToast, setUser } = useTagdeer();

    // Dynamic Business Context Search
    const myBusiness = businesses?.find(b => b.claimed_by === user?.id) || businesses?.[0] || null;

    // Account Level
    const [accountTier, setAccountTier] = useState('Free'); // 'Free', 'Pro', 'Enterprise'
    const [subscription, setSubscription] = useState(null);
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
            // Fetch actual subscription
            const fetchSub = async () => {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('profile_id', user.id)
                    .eq('status', 'active')
                    .single();

                if (data && data.tier) {
                    setSubscription(data);
                    setAccountTier(data.tier);
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

    // Business Level (Contextual)
    const [businessShield, setBusinessShield] = useState(0); // 0 = None, 1 = Trust, 2 = Fatora
    const [storefrontEnabled, setStorefrontEnabled] = useState(true);

    useEffect(() => {
        if (myBusiness) {
            setBusinessShield(myBusiness.is_shielded ? 1 : 0); // Simplified for now since we just have a boolean in db
        }
    }, [myBusiness]);

    const handleShieldToggle = async (level) => {
        if (!myBusiness || !supabase) return;
        try {
            const newStatus = level > 0;
            const { error } = await supabase
                .from('businesses')
                .update({ is_shielded: newStatus })
                .eq('id', myBusiness.id);

            if (error) throw error;
            setBusinessShield(level);
            if (showToast) showToast(`Shield level updated successfully!`);
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Failed to update shield settings.', 'error');
        }
    };

    const handlePasswordReset = async () => {
        if (!supabase || !user?.email) return;
        try {
            const redirectUrl = `${window.location.origin}/auth/callback?next=/merchant/reset-password`;
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
                    .select('id, role, created_at, profile_id, profiles(full_name, email, phone)')
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
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* FREE TIER */}
                                        <div className={`p-4 rounded-xl border-2 transition-all ${accountTier === 'Free' ? 'border-slate-400 bg-slate-50 dark:bg-slate-900/50' : 'border-slate-200 dark:border-slate-800 opacity-60'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold">Free</h3>
                                                    <p className="text-sm font-semibold text-slate-500">0 LYD / month</p>
                                                </div>
                                                {accountTier === 'Free' && <CheckCircle2 className="w-5 h-5 text-slate-600" />}
                                            </div>
                                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-4">
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1 Business Location</li>
                                                <li className="flex items-center gap-2 opacity-50"><Lock className="w-3 h-3" /> No Loyalty Campaigns</li>
                                                <li className="flex items-center gap-2 opacity-50"><Lock className="w-3 h-3" /> No Team Management</li>
                                                <li className="flex items-center gap-2 opacity-50"><Lock className="w-3 h-3" /> No Resolution / Shield</li>
                                            </ul>
                                        </div>

                                        {/* PRO TIER */}
                                        <div className={`p-4 rounded-xl border-2 transition-all ${accountTier === 'Pro' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">Pro</h3>
                                                    <p className="text-sm font-semibold text-blue-600">~150 LYD / month</p>
                                                </div>
                                                {accountTier === 'Pro' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                            </div>
                                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-4">
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Unlimited Locations</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1 Active Campaign (5 Coupons)</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Team Management</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Discovery Ribbon Ad</li>
                                            </ul>
                                            {accountTier === 'Free' && (
                                                <Button variant="outline" size="sm" className="w-full mt-4 border-blue-200 text-blue-700 hover:bg-blue-50">Upgrade to Pro</Button>
                                            )}
                                        </div>

                                        {/* ENTERPRISE TIER */}
                                        <div className={`p-4 rounded-xl border-2 transition-all ${accountTier === 'Enterprise' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-purple-300'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-purple-500" /> Enterprise</h3>
                                                    <p className="text-sm font-semibold text-purple-600 bg-clip-text">~350 LYD / month</p>
                                                </div>
                                                {accountTier === 'Enterprise' && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                                            </div>
                                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-4">
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Unlimited Campaigns & Coupons</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 30 Scan Points (Highest)</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Trust Shields Included</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolution & Disputes Included</li>
                                            </ul>
                                            {accountTier !== 'Enterprise' && (
                                                <Button size="sm" className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-lg shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700">
                                                    Upgrade to Enterprise
                                                </Button>
                                            )}
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
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                                                <Store className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">Digital Storefront</h4>
                                                <p className="text-sm text-slate-500">Allow customers to view menus/catalogs and request quotes directly.</p>
                                            </div>
                                        </div>
                                        <Switch checked={storefrontEnabled} onCheckedChange={setStorefrontEnabled} />
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
