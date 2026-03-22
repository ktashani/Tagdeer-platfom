"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, ShieldCheck, Mail, Phone, Lock, UserPlus, Users, Store, Crown, Building, Trash2, CheckCircle2, ArrowUpRight, Loader2, Sparkles, Tag, Clock } from "lucide-react";
import { useTagdeer } from '@/context/TagdeerContext';
import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe } from 'lucide-react';

export default function MerchantSettings() {
    const { user, businesses, supabase, showToast, setUser, tierPricing = [], lang = 'en' } = useTagdeer();
    const router = useRouter();
    const searchParams = useSearchParams();
    const trialCampaignId = searchParams.get('trial_campaign');

    const { activeBusiness: myBusiness, claimStatuses } = useActiveBusiness();

    const STATUS_BADGES = {
        'Active': { label: 'Active', class: 'bg-emerald-100 text-emerald-700' },
        'Expiring Soon': { label: 'Expiring Soon', class: 'bg-amber-100 text-amber-700' },
        'Grace Period': { label: 'Grace Period', class: 'bg-red-100 text-red-700' },
        'Pending': { label: 'Awaiting Payment', class: 'bg-blue-100 text-blue-700' },
        'Suspended': { label: 'Suspended', class: 'bg-red-100 text-red-700' },
        'Terminated': { label: 'Terminated', class: 'bg-slate-100 text-slate-700' }
    };

    // Business gating: lock business-specific tabs when claim is pending
    const isBusinessLocked = useMemo(() => {
        if (!myBusiness) return true;
        const status = claimStatuses[myBusiness.id];
        return status === 'pending' || status === 'missing_docs';
    }, [myBusiness, claimStatuses]);

    // Account Level
    const [accountTier, setAccountTier] = useState('Free'); // 'Free', 'Pro', 'Enterprise'
    const [subscription, setSubscription] = useState(null);
    const [pendingUpgrade, setPendingUpgrade] = useState(null);
    const [quotaUsage, setQuotaUsage] = useState({ locationsUsed: 0, shieldsAssigned: 0, storefrontsAssigned: 0 });
    const [personalInfo, setPersonalInfo] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Business contact details state
    const [businessContact, setBusinessContact] = useState({
        description: '', phone: '', whatsapp: '', instagram: '',
        facebook: '', website: '', google_maps_url: ''
    });
    const [isSavingContact, setIsSavingContact] = useState(false);

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
                    .in('status', ['Active', 'Expiring Soon', 'Grace Period', 'Pending'])
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

                // Check for pending upgrade request
                const { data: pendingTxn } = await supabase
                    .from('transactions')
                    .select('id, requested_tier, created_at, status')
                    .eq('owner_id', user.id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (pendingTxn) {
                    setPendingUpgrade({
                        id: pendingTxn.id,
                        tier: pendingTxn.requested_tier,
                        date: new Date(pendingTxn.created_at).toLocaleDateString()
                    });
                }

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
                    if (data.status === 'Active') {
                        const expiresAt = new Date(data.expires_at);
                        if (expiresAt < new Date()) {
                            await supabase
                                .from('subscriptions')
                                .update({ status: 'Expired' })
                                .eq('id', data.id);
                            setAccountTier('Free');
                        } else {
                            setAccountTier(data.tier);
                        }
                    } else if (data.status === 'Pending') {
                        setAccountTier('Pending');
                    } else if (data.status === 'Grace Period' || data.status === 'Expiring Soon') {
                        setAccountTier(data.tier); // Still show tier features during grace
                    } else {
                        setAccountTier('Free');
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

    // Fetch business contact details when business is found
    useEffect(() => {
        if (myBusiness && supabase) {
            (async () => {
                const { data } = await supabase
                    .from('businesses')
                    .select('description, phone, whatsapp, instagram, facebook, website, google_maps_url')
                    .eq('id', myBusiness.id)
                    .single();
                if (data) setBusinessContact({
                    description: data.description || '',
                    phone: data.phone || '',
                    whatsapp: data.whatsapp || '',
                    instagram: data.instagram || '',
                    facebook: data.facebook || '',
                    website: data.website || '',
                    google_maps_url: data.google_maps_url || ''
                });
            })();
        }
    }, [myBusiness, supabase]);

    const handleSaveBusinessContact = async () => {
        if (!supabase || !myBusiness) return;
        setIsSavingContact(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update(businessContact)
                .eq('id', myBusiness.id);
            if (error) throw error;
            if (showToast) showToast('Business contact details saved!');
        } catch (err) {
            console.error('Business contact save error:', err?.message || err?.code || err?.details || JSON.stringify(err));
            if (showToast) showToast(err?.message || 'Failed to save contact details.', 'error');
        } finally {
            setIsSavingContact(false);
        }
    };

    const handleTierUpgrade = async (tier) => {
        if (tier.isFreebie) {
            // Bypass payment — create subscription directly
            try {
                const { error } = await supabase.from('subscriptions').upsert({
                    profile_id: user.id,
                    tier: tier.name,
                    status: 'Active',
                    quotas: tier.allocations || {},
                    is_trial: false,
                    started_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }, { onConflict: 'profile_id' });

                if (error) {
                    console.error('Tier upgrade upsert error:', error);
                    showToast(
                        lang === 'ar'
                            ? 'فشل تفعيل الباقة. تواصل مع الدعم.'
                            : `Failed to activate tier: ${error.message}`,
                        'error'
                    );
                    return;
                }

                // Update local state directly instead of reload to avoid MerchantGuard race
                setAccountTier(tier.name);
                setSubscription(prev => ({
                    ...prev,
                    tier: tier.name,
                    status: 'Active',
                    quotas: tier.allocations || {},
                }));
                showToast(
                    lang === 'ar'
                        ? 'تم تفعيل الباقة! استمتع بخدماتك المجانية. 🎁'
                        : 'Tier activated! Enjoy your free access. 🎁'
                );
            } catch (err) {
                console.error('Tier upgrade exception:', err);
                showToast(
                    lang === 'ar'
                        ? 'حدث خطأ غير متوقع. حاول مرة أخرى.'
                        : 'An unexpected error occurred. Please try again.',
                    'error'
                );
            }
            return;
        }

        // Paid tier upgrade — create pending transaction for admin review
        if (!myBusiness) {
            showToast('Please select a business first.', 'error');
            return;
        }

        try {
            const { error } = await supabase.from('transactions').insert([{
                owner_id: user.id,
                business_id: myBusiness.id,
                amount: tier.price || 0,
                status: 'pending',
                payment_method: 'manual',
                requested_tier: tier.name,
                upgrade_from_tier: accountTier || 'Free',
                duration: '1 Month',
                currency: 'LYD',
                payment_gateway: 'manual_bank'
            }]);

            if (error) throw error;
            setPendingUpgrade({ id: null, tier: tier.name, date: new Date().toLocaleDateString() });
            showToast(
                lang === 'ar'
                    ? `تم إرسال طلب الترقية إلى ${tier.name_ar || tier.name}! يرجى إتمام التحويل البنكي. سيتم تفعيل باقتك فور تأكيد الدفع من الإدارة.`
                    : `Upgrade request to ${tier.name} submitted! Please complete the bank transfer. Your plan will activate once payment is confirmed by admin.`,
                'success'
            );
        } catch (err) {
            console.error('Tier upgrade request error:', err);
            showToast(
                lang === 'ar'
                    ? 'فشل إرسال طلب الترقية. حاول مرة أخرى.'
                    : 'Failed to submit upgrade request.',
                'error'
            );
        }
    };

    const requestAddonPurchase = async (addonName) => {
        if (!user || !supabase || !myBusiness) return;
        try {
            const { error } = await supabase.from('transactions').insert([{
                owner_id: user.id,
                business_id: myBusiness.id,
                amount: 0,
                status: 'pending',
                payment_method: 'manual',
                requested_tier: `${addonName} Addon`,
                duration: '1 Month',
                currency: 'LYD',
                payment_gateway: 'manual_bank'
            }]);
            if (error) throw error;
            if (showToast) showToast(`Purchase request for ${addonName} Addon submitted. Pending bank transfer approval.`, 'success');
        } catch (err) {
            console.error('Failed to request addon:', err);
            if (showToast) showToast(`Failed to request ${addonName} Addon.`, 'error');
        }
    };

    // Business Level (Contextual)
    const [businessShield, setBusinessShield] = useState(0); // 0 = None, 1 = Trust, 2 = Fatora
    const [businessStorefront, setBusinessStorefront] = useState(false);

    // Ribbon state
    const [activeRibbon, setActiveRibbon] = useState(null);
    const [ribbonConfig, setRibbonConfig] = useState(null);
    const [ribbonForm, setRibbonForm] = useState({ ribbon_type: 'discount', label: '', color: 'red' });
    const [isSavingRibbon, setIsSavingRibbon] = useState(false);

    // Load ribbon config from platform_config
    useEffect(() => {
        if (!supabase) return;
        (async () => {
            const { data } = await supabase.from('platform_config').select('value').eq('key', 'ribbon_config').maybeSingle();
            if (data?.value) setRibbonConfig(data.value);
        })();
    }, [supabase]);

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

                // Fetch active ribbon for this business
                const { data: ribbonData } = await supabase
                    .from('business_ribbons')
                    .select('*')
                    .eq('business_id', myBusiness.id)
                    .eq('is_active', true)
                    .maybeSingle();
                if (ribbonData) {
                    setActiveRibbon(ribbonData);
                    setRibbonForm({ ribbon_type: ribbonData.ribbon_type, label: ribbonData.label, color: ribbonData.color });
                }
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
                    if (showToast) showToast(`You have reached your allocation limit of ${maxShields} Shields. Requesting Addon purchase...`, 'error');
                    await requestAddonPurchase('Shield');
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
                    if (showToast) showToast(`You have reached your allocation limit of ${maxStorefronts} Storefronts. Requesting Addon purchase...`, 'error');
                    await requestAddonPurchase('Storefront');
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
                            className={`w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium relative ${isBusinessLocked ? 'opacity-50' : ''}`}
                        >
                            <Store className="w-4 h-4 mr-3 opacity-70" /> Business Settings
                            {isBusinessLocked && <Lock className="w-3 h-3 absolute right-4 text-amber-500" />}
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className={`w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium relative ${isBusinessLocked ? 'opacity-50' : ''}`}
                        >
                            <UserPlus className="w-4 h-4 mr-3 opacity-70" /> Team Management
                            {(accountTier === 'Free' || isBusinessLocked) && <Lock className={`w-3 h-3 absolute right-4 ${isBusinessLocked ? 'text-amber-500' : 'text-slate-400'}`} />}
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
                                            {subscription?.status && STATUS_BADGES[subscription.status] && (
                                                <Badge className={`${STATUS_BADGES[subscription.status].class} border-0`}>
                                                    {STATUS_BADGES[subscription.status].label}
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Determines your global platform capabilities, loyalty campaigns, and team size.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Pending Upgrade Banner */}
                                    {pendingUpgrade && (
                                        <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                                                    <Clock className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-amber-800 dark:text-amber-300">
                                                        {lang === 'ar' ? 'طلب ترقية قيد المراجعة' : 'Upgrade Request Pending'}
                                                    </p>
                                                    <p className="text-sm text-amber-600 dark:text-amber-400">
                                                        {lang === 'ar'
                                                            ? `تم طلب الترقية إلى ${pendingUpgrade.tier} بتاريخ ${pendingUpgrade.date}. بانتظار تأكيد الدفع.`
                                                            : `Requested ${pendingUpgrade.tier} on ${pendingUpgrade.date}. Awaiting payment confirmation.`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                                                {lang === 'ar' ? 'قيد الانتظار' : 'Pending'}
                                            </Badge>
                                        </div>
                                    )}
                                    <div className={`grid grid-cols-1 gap-4 ${
                                        tierPricing.length === 1
                                            ? 'max-w-md'
                                            : tierPricing.length === 2
                                                ? 'md:grid-cols-2 max-w-2xl'
                                                : tierPricing.length === 3
                                                    ? 'md:grid-cols-3'
                                                    : 'md:grid-cols-2 lg:grid-cols-4'
                                    }`}>
                                        {tierPricing.map((tier) => {
                                            const isActiveTier = accountTier?.toLowerCase() === tier.id?.toLowerCase() || accountTier?.toLowerCase() === tier.name?.toLowerCase();
                                            const isEnterprise = tier.id?.toLowerCase().includes('enterprise');
                                            const isPro = tier.id?.toLowerCase().includes('pro');

                                            const displayFeatures = lang === 'ar' && tier.features_ar?.length > 0
                                                ? tier.features_ar
                                                : tier.features || [];

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
                                                                {lang === 'ar' && tier.name_ar ? tier.name_ar : tier.name}
                                                            </h3>
                                                            {tier.isFreebie ? (
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-lg line-through text-slate-400">{tier.originalPrice || tier.price} LYD</span>
                                                                    <span className="text-2xl font-black text-emerald-600">Free</span>
                                                                    <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-xs">🎁 LIMITED OFFER</Badge>
                                                                </div>
                                                            ) : (
                                                                <p className={`text-sm font-semibold ${isEnterprise ? 'text-purple-600' : isPro ? 'text-blue-600' : 'text-slate-500'}`}>
                                                                    {tier.price} {lang === 'ar' ? 'د.ل / شهرياً' : 'LYD / month'}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isActiveTier && <CheckCircle2 className={`w-5 h-5 ${isEnterprise ? 'text-purple-600' : isPro ? 'text-blue-600' : 'text-slate-600'}`} />}
                                                    </div>
                                                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-4 flex-1">
                                                        {displayFeatures.map((feature, fIdx) => (
                                                            <li key={fIdx} className="flex items-center gap-2">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {feature}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    {!isActiveTier && (
                                                        <Button
                                                            onClick={() => handleTierUpgrade(tier)}
                                                            disabled={pendingUpgrade?.tier === tier.name}
                                                            variant={isPro ? "default" : "outline"}
                                                            size="sm"
                                                            className={`w-full mt-4 ${
                                                                pendingUpgrade?.tier === tier.name
                                                                    ? 'opacity-50 cursor-not-allowed'
                                                                    : isEnterprise
                                                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-lg shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700'
                                                                        : isPro ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {pendingUpgrade?.tier === tier.name
                                                                ? (lang === 'ar' ? '⏳ بانتظار التأكيد' : '⏳ Awaiting Confirmation')
                                                                : `${lang === 'ar' ? 'ترقية إلى' : 'Upgrade to'} ${lang === 'ar' && tier.name_ar ? tier.name_ar : tier.name}`
                                                            }
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

                            {isBusinessLocked ? (
                                <Card className="border-dashed border-2 border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 text-center py-16">
                                    <CardContent className="flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-full flex items-center justify-center">
                                            <Lock className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold">Business Settings Locked</h3>
                                            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                                Your business claim is currently under review. These settings will unlock once your business is approved by the Tagdeer admin team.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                            Pending Approval
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ) : (
                            <>

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

                            {/* Business Ribbon */}
                            {myBusiness && (
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-5 h-5 text-amber-500" />
                                            <CardTitle>Business Ribbon</CardTitle>
                                        </div>
                                        <CardDescription>Display a promotional ribbon on your business card in the Discover page. 1 active ribbon per business.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {activeRibbon ? (
                                            <div className="space-y-4">
                                                {/* Current ribbon preview */}
                                                <div className={`p-4 rounded-xl border-2 border-amber-500 bg-amber-50/30 dark:bg-amber-900/10`}>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`px-3 py-1.5 rounded-full text-white text-sm font-bold ${{
                                                                red: 'bg-red-500', green: 'bg-emerald-500', blue: 'bg-blue-500',
                                                                amber: 'bg-amber-500', purple: 'bg-purple-500', pink: 'bg-pink-500', orange: 'bg-orange-500'
                                                            }[activeRibbon.color] || 'bg-red-500'}`}>
                                                                {activeRibbon.label}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold">{activeRibbon.ribbon_type}</p>
                                                                <p className="text-xs text-slate-500">
                                                                    Active since {new Date(activeRibbon.created_at).toLocaleDateString()}
                                                                    {activeRibbon.expires_at && ` — expires ${new Date(activeRibbon.expires_at).toLocaleDateString()}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            disabled={isSavingRibbon}
                                                            onClick={async () => {
                                                                setIsSavingRibbon(true);
                                                                try {
                                                                    await supabase.from('business_ribbons').update({ is_active: false }).eq('id', activeRibbon.id);
                                                                    setActiveRibbon(null);
                                                                    if (showToast) showToast('Ribbon deactivated.');
                                                                } catch (err) {
                                                                    if (showToast) showToast('Failed to deactivate ribbon.', 'error');
                                                                } finally {
                                                                    setIsSavingRibbon(false);
                                                                }
                                                            }}
                                                        >
                                                            Deactivate
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Ribbon type selector */}
                                                <div className="space-y-2">
                                                    <Label>Ribbon Type</Label>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {(ribbonConfig?.types || [
                                                            { id: 'discount', label: 'Discount', icon: '🏷️' },
                                                            { id: 'announcement', label: 'Announcement', icon: '📢' },
                                                            { id: 'seasonal', label: 'Seasonal', icon: '🎄' },
                                                            { id: 'event', label: 'Event', icon: '🎉' }
                                                        ]).map(type => (
                                                            <button
                                                                key={type.id}
                                                                onClick={() => setRibbonForm(prev => ({ ...prev, ribbon_type: type.id }))}
                                                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${ribbonForm.ribbon_type === type.id
                                                                    ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                                    }`}
                                                            >
                                                                {type.icon} {type.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Ribbon label */}
                                                <div className="space-y-2">
                                                    <Label>Ribbon Text</Label>
                                                    <Input
                                                        value={ribbonForm.label}
                                                        onChange={e => setRibbonForm(prev => ({ ...prev, label: e.target.value }))}
                                                        placeholder='e.g. "50% OFF", "Grand Opening", "New Menu"'
                                                        maxLength={30}
                                                    />
                                                </div>

                                                {/* Color picker */}
                                                <div className="space-y-2">
                                                    <Label>Ribbon Color</Label>
                                                    <div className="flex gap-2">
                                                        {['red', 'green', 'blue', 'amber', 'purple', 'pink', 'orange'].map(color => {
                                                            const colorMap = {
                                                                red: 'bg-red-500', green: 'bg-emerald-500', blue: 'bg-blue-500',
                                                                amber: 'bg-amber-500', purple: 'bg-purple-500', pink: 'bg-pink-500', orange: 'bg-orange-500'
                                                            };
                                                            return (
                                                                <button
                                                                    key={color}
                                                                    onClick={() => setRibbonForm(prev => ({ ...prev, color }))}
                                                                    className={`w-8 h-8 rounded-full ${colorMap[color]} transition-all ${ribbonForm.color === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-blue-500 scale-110' : 'opacity-60 hover:opacity-100'
                                                                        }`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Preview */}
                                                {ribbonForm.label && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500">Preview:</span>
                                                        <div className={`px-3 py-1 rounded-full text-white text-sm font-bold ${{
                                                            red: 'bg-red-500', green: 'bg-emerald-500', blue: 'bg-blue-500',
                                                            amber: 'bg-amber-500', purple: 'bg-purple-500', pink: 'bg-pink-500', orange: 'bg-orange-500'
                                                        }[ribbonForm.color] || 'bg-red-500'}`}>
                                                            {ribbonForm.label}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Activate button */}
                                                <Button
                                                    disabled={!ribbonForm.label || isSavingRibbon}
                                                    className="bg-amber-500 hover:bg-amber-600 text-white"
                                                    onClick={async () => {
                                                        if (!myBusiness || !supabase || !user) return;
                                                        setIsSavingRibbon(true);
                                                        try {
                                                            // Check ribbon allocation
                                                            const maxRibbons = subscription?.quotas?.max_ribbons || 0;
                                                            if (maxRibbons === 0) {
                                                                if (showToast) showToast('Ribbons are not included. Requesting Addon purchase...', 'error');
                                                                setIsSavingRibbon(false);
                                                                await requestAddonPurchase('Ribbon');
                                                                return;
                                                            }

                                                            // Deactivate any existing active ribbons for this business
                                                            await supabase.from('business_ribbons').update({ is_active: false }).eq('business_id', myBusiness.id).eq('is_active', true);

                                                            // Insert new ribbon
                                                            const expiresAt = new Date();
                                                            expiresAt.setMonth(expiresAt.getMonth() + 1);
                                                            const { data: newRibbon, error } = await supabase.from('business_ribbons').insert({
                                                                business_id: myBusiness.id,
                                                                ribbon_type: ribbonForm.ribbon_type,
                                                                label: ribbonForm.label,
                                                                color: ribbonForm.color,
                                                                expires_at: expiresAt.toISOString(),
                                                                source: 'merchant'
                                                            }).select().single();

                                                            if (error) throw error;
                                                            setActiveRibbon(newRibbon);
                                                            if (showToast) showToast('Ribbon activated! It will appear on your business card.');
                                                        } catch (err) {
                                                            console.error(err);
                                                            if (showToast) showToast(err?.message || 'Failed to activate ribbon.', 'error');
                                                        } finally {
                                                            setIsSavingRibbon(false);
                                                        }
                                                    }}
                                                >
                                                    {isSavingRibbon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tag className="w-4 h-4 mr-2" />}
                                                    Activate Ribbon
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Business Contact Details — editable after claiming */}
                            {myBusiness && (
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-5 h-5 text-blue-600" />
                                            <CardTitle>Business Contact Details</CardTitle>
                                        </div>
                                        <CardDescription>Add your business details to appear in the Discover directory as your public address book.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label className="text-sm text-slate-500 mb-1 block">Business Description</Label>
                                            <textarea
                                                value={businessContact.description}
                                                onChange={(e) => setBusinessContact(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder="Tell customers about your business..."
                                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                                rows={3}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">📞 Phone Number</Label>
                                                <Input value={businessContact.phone} onChange={(e) => setBusinessContact(prev => ({ ...prev, phone: e.target.value }))} placeholder="+218 91 xxx xxxx" className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">💬 WhatsApp</Label>
                                                <Input value={businessContact.whatsapp} onChange={(e) => setBusinessContact(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="+218 91 xxx xxxx" className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">📸 Instagram</Label>
                                                <Input value={businessContact.instagram} onChange={(e) => setBusinessContact(prev => ({ ...prev, instagram: e.target.value }))} placeholder="@yourbusiness or URL" className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">📘 Facebook</Label>
                                                <Input value={businessContact.facebook} onChange={(e) => setBusinessContact(prev => ({ ...prev, facebook: e.target.value }))} placeholder="Page URL or @username" className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">🌐 Website</Label>
                                                <Input value={businessContact.website} onChange={(e) => setBusinessContact(prev => ({ ...prev, website: e.target.value }))} placeholder="https://yourbusiness.com" className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                            <div>
                                                <Label className="text-sm text-slate-500 mb-1 block">📍 Google Maps Link</Label>
                                                <Input value={businessContact.google_maps_url} onChange={(e) => setBusinessContact(prev => ({ ...prev, google_maps_url: e.target.value }))} placeholder="https://maps.google.com/..." className="dark:bg-slate-900 dark:border-slate-700" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSaveBusinessContact} disabled={isSavingContact} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                {isSavingContact ? 'Saving...' : 'Save Contact Details'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            </>
                            )}
                        </TabsContent>

                        {/* ==========================================
                            TAB 3: TEAM MANAGEMENT (TIER 2 ONLY)
                        ========================================== */}
                        <TabsContent value="team" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            {isBusinessLocked ? (
                                <Card className="border-dashed border-2 border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 text-center py-16">
                                    <CardContent className="flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-full flex items-center justify-center">
                                            <Lock className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold">Team Management Locked</h3>
                                            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                                Team management requires an approved business. Once your business claim is verified, you can invite and manage team members.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                            Pending Approval
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ) : accountTier === 'Free' ? (
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
