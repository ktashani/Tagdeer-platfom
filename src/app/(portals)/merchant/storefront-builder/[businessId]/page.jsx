"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Save, Eye, ArrowLeft, LayoutTemplate, Link as LinkIcon, Edit3,
    Image as ImageIcon, MapPin, Store, Smartphone, Trash2, Camera,
    UploadCloud, Loader2, Package, BarChart3, Plus, FileText,
    ExternalLink, Pencil, X, Check
} from "lucide-react";
import { getPresignedUploadUrl } from '@/app/actions/storage';

export default function StorefrontBuilder() {
    const { user, supabase, showToast } = useTagdeer();
    const router = useRouter();
    const params = useParams();
    const businessId = params.businessId;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [storefront, setStorefront] = useState({
        slug: '',
        status: 'draft',
        theme_config: { primaryColor: '#10b981', secondaryColor: '#0f172a' },
        seo_metadata: { title: '', description: '', og_image: '', meta_pixel_id: '', google_ads_id: '', gtm_id: '', search_console_id: '', whatsapp: '' },
        contact_overrides: { phone: '', email: '', facebook: '', instagram: '', website: '' },
        description: '',
        logo_url: '',
        banner_url: '',
        gallery_images: []
    });
    const [originalSlug, setOriginalSlug] = useState('');
    const [businessData, setBusinessData] = useState(null);

    // Product catalog state
    const [catalogItems, setCatalogItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [showImportPanel, setShowImportPanel] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importPreview, setImportPreview] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [csvFile, setCsvFile] = useState(null);

    useEffect(() => {
        if (!user || !supabase || !businessId) return;

        const loadStorefront = async () => {
            setIsLoading(true);
            try {
                const { data: allocation } = await supabase
                    .from('feature_allocations')
                    .select('id')
                    .eq('business_id', businessId)
                    .eq('feature_type', 'storefront')
                    .eq('status', 'active')
                    .single();

                if (!allocation) {
                    showToast('Storefront feature not enabled for this business.', 'error');
                    router.push('/merchant/settings');
                    return;
                }

                const { data: biz } = await supabase.from('businesses').select('*').eq('id', businessId).single();
                setBusinessData(biz);

                const { data: sfData } = await supabase
                    .from('storefronts')
                    .select('*')
                    .eq('business_id', businessId)
                    .maybeSingle();

                if (sfData) {
                    sfData.gallery_images = sfData.gallery_images || [];
                    sfData.seo_metadata = { title: '', description: '', og_image: '', meta_pixel_id: '', google_ads_id: '', gtm_id: '', search_console_id: '', whatsapp: '', ...sfData.seo_metadata };
                    sfData.contact_overrides = { phone: '', email: '', facebook: '', instagram: '', website: '', ...sfData.contact_overrides };
                    setStorefront(sfData);
                    setOriginalSlug(sfData.slug);

                    // Load catalog items
                    if (sfData.id) {
                        const { data: items } = await supabase
                            .from('catalog_items')
                            .select('*')
                            .eq('storefront_id', sfData.id)
                            .order('display_order', { ascending: true });
                        setCatalogItems(items || []);
                    }
                } else {
                    const suggestedSlug = biz?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
                    setStorefront(prev => ({ ...prev, slug: suggestedSlug, seo_metadata: { ...prev.seo_metadata, title: biz?.name } }));
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to load builder.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadStorefront();
    }, [user, supabase, businessId]);

    // ─── SAVE HANDLER ───────────────────────────────────────────
    const handleSave = async (publish = false) => {
        if (!storefront.slug) {
            showToast('A unique URL slug is required.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                business_id: businessId,
                slug: storefront.slug.toLowerCase().trim(),
                theme_config: storefront.theme_config,
                seo_metadata: storefront.seo_metadata,
                contact_overrides: storefront.contact_overrides,
                description: storefront.description,
                logo_url: storefront.logo_url,
                banner_url: storefront.banner_url,
                gallery_images: (storefront.gallery_images || []).filter(img => img && img.trim() !== ''),
                status: publish ? 'published' : storefront.status,
                updated_at: new Date().toISOString()
            };

            // Safety check for embedded Base64 images
            const allLinks = [payload.logo_url, payload.banner_url, ...(payload.gallery_images || [])];
            for (const link of allLinks) {
                if (link && link.startsWith('data:image')) {
                    throw new Error("Embedded image data (Base64) found. Please DELETE the link starting with 'data:image' and use the 'Upload from Device' button.");
                }
            }

            // Bypass Supabase JS client entirely — use raw fetch to PostgREST
            // This avoids the async generator hang caused by Next.js HMR/Fast Refresh
            const { data: sessionData } = await supabase.auth.getSession();
            const jwt = sessionData?.session?.access_token;
            if (!jwt) throw new Error('Session expired. Please refresh the page and log in again.');

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            console.log('[SAVE] Sending upsert via raw fetch...');
            const res = await fetch(`${supabaseUrl}/rest/v1/storefronts?on_conflict=business_id`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`,
                    'apikey': supabaseAnonKey,
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(12000),
            });

            const result = await res.json();
            console.log('[SAVE] Response status:', res.status, 'Data:', result);

            if (!res.ok) {
                const errMsg = result?.message || result?.error || JSON.stringify(result);
                if (errMsg.includes('unique') || errMsg.includes('23505')) throw new Error('That URL slug is already taken by another business.');
                if (errMsg.includes('foreign') || errMsg.includes('23503')) throw new Error('Business ID does not exist in the database.');
                throw new Error(errMsg);
            }

            // Update local state with returned data
            const saved = Array.isArray(result) ? result[0] : result;
            if (saved) {
                setStorefront(prev => ({ ...prev, ...saved, status: publish ? 'published' : prev.status }));
            }
            setOriginalSlug(storefront.slug);
            showToast(publish ? 'Storefront Published Successfully!' : 'Draft Saved!', 'success');
        } catch (err) {
            console.error('[SAVE] Error:', err);
            if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                showToast('Save timed out. Please check your connection and try again.', 'error');
            } else {
                showToast(err.message || 'Failed to save storefront.', 'error');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // ─── PRODUCT CRUD ───────────────────────────────────────────
    const handleSaveProduct = async (item) => {
        if (!item.name?.trim()) {
            showToast('Product name is required.', 'error');
            return;
        }
        if (!storefront.id) {
            showToast('Please save the storefront first before adding products.', 'error');
            return;
        }

        const productPayload = {
            storefront_id: storefront.id,
            name: item.name.trim(),
            description: item.description || '',
            price: parseFloat(item.price) || 0,
            category: item.category || 'General',
            sku: item.sku || null,
            image_url: item.image_url || null,
            is_active: item.is_active !== false,
            display_order: item.display_order ?? catalogItems.length,
        };

        try {
            if (item.id) {
                const { error } = await supabase.from('catalog_items').update(productPayload).eq('id', item.id);
                if (error) throw error;
                setCatalogItems(prev => prev.map(p => p.id === item.id ? { ...p, ...productPayload } : p));
            } else {
                const { data, error } = await supabase.from('catalog_items').insert(productPayload).select().single();
                if (error) throw error;
                setCatalogItems(prev => [...prev, data]);
            }
            setEditingItem(null);
            showToast('Product saved!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to save product.', 'error');
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!confirm('Delete this product?')) return;
        const { error } = await supabase.from('catalog_items').delete().eq('id', id);
        if (!error) {
            setCatalogItems(prev => prev.filter(p => p.id !== id));
            showToast('Product deleted.', 'success');
        }
    };

    // ─── IMPORT HANDLERS ────────────────────────────────────────
    const handleFetchFeed = async () => {
        if (!importUrl.trim()) return;
        setIsImporting(true);
        try {
            const res = await fetch('/api/merchant/parse-catalog-feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: importUrl.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setImportPreview(data.products || []);
            showToast(`Found ${data.count} products (${data.format} format)`, 'success');
        } catch (err) {
            showToast(err.message || 'Failed to parse feed.', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const handleCsvUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.split('\n').filter(l => l.trim());
                const delimiter = text.includes('\t') ? '\t' : ',';
                const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                const products = lines.slice(1).map(line => {
                    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
                    return {
                        name: obj.name || obj.title || obj.product_name || '',
                        description: (obj.description || obj.desc || '').slice(0, 500),
                        price: parseFloat(obj.price || obj.amount || '0'),
                        category: obj.category || obj.type || 'General',
                        image_url: obj.image_url || obj.image || '',
                        sku: obj.sku || obj.id || '',
                    };
                }).filter(p => p.name);
                setImportPreview(products);
                showToast(`Parsed ${products.length} products from CSV`, 'success');
            } catch (err) {
                showToast('Failed to parse CSV file.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleBulkInsert = async () => {
        if (!importPreview?.length || !storefront.id) return;
        setIsImporting(true);
        try {
            const payload = importPreview.map((item, i) => ({
                storefront_id: storefront.id,
                name: item.name,
                description: item.description || '',
                price: item.price || 0,
                category: item.category || 'General',
                sku: item.sku || null,
                image_url: item.image_url || null,
                display_order: catalogItems.length + i,
                is_active: true,
            }));
            const { data, error } = await supabase.from('catalog_items').insert(payload).select();
            if (error) throw error;
            setCatalogItems(prev => [...prev, ...(data || [])]);
            setImportPreview(null);
            setShowImportPanel(false);
            setImportUrl('');
            showToast(`${data?.length || 0} products imported!`, 'success');
        } catch (err) {
            showToast(err.message || 'Import failed.', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    // ─── GALLERY / ASSET UPLOADS ────────────────────────────────
    const handleGalleryUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('File size must be less than 5MB.', 'error'); return; }

        setIsUploading(true);
        try {
            const uploadInit = await getPresignedUploadUrl({ folder: 'storefront_gallery', filename: file.name, contentType: file.type || 'application/octet-stream' });
            if (!uploadInit?.success || !uploadInit.uploadUrl) throw new Error("Failed to initialize upload");
            const response = await fetch(uploadInit.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
            if (!response.ok) throw new Error("Upload failed");
            const publicUrlBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-2e291b2cd42547b5957eac5e913acd6e.r2.dev').replace(/\/$/, '');
            const fullUrl = `${publicUrlBase}/${uploadInit.objectKey}`;
            setStorefront(prev => ({ ...prev, gallery_images: [...(prev.gallery_images || []), fullUrl] }));
            showToast('Image uploaded!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to upload.', 'error');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleAssetUpload = async (e, type) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Logo/Banner must be less than 2MB.', 'error'); return; }

        setIsUploading(true);
        try {
            const uploadInit = await getPresignedUploadUrl({ folder: `storefront_${type}`, filename: file.name, contentType: file.type || 'application/octet-stream' });
            if (!uploadInit?.success || !uploadInit.uploadUrl) throw new Error("Failed to initialize upload");
            const response = await fetch(uploadInit.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
            if (!response.ok) throw new Error("Upload failed");
            const publicUrlBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-2e291b2cd42547b5957eac5e913acd6e.r2.dev').replace(/\/$/, '');
            const fullUrl = `${publicUrlBase}/${uploadInit.objectKey}`;
            setStorefront(prev => ({ ...prev, [`${type}_url`]: fullUrl }));
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!`, 'success');
        } catch (err) {
            showToast(err.message || 'Failed to upload.', 'error');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleProductImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Image must be less than 2MB.', 'error'); return; }

        setIsUploading(true);
        try {
            const uploadInit = await getPresignedUploadUrl({ folder: 'storefront_products', filename: file.name, contentType: file.type || 'application/octet-stream' });
            if (!uploadInit?.success || !uploadInit.uploadUrl) throw new Error("Failed to initialize upload");
            const response = await fetch(uploadInit.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
            if (!response.ok) throw new Error("Upload failed");
            const publicUrlBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-2e291b2cd42547b5957eac5e913acd6e.r2.dev').replace(/\/$/, '');
            const fullUrl = `${publicUrlBase}/${uploadInit.objectKey}`;
            setEditingItem(prev => ({ ...prev, image_url: fullUrl }));
            showToast('Product image uploaded!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to upload.', 'error');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    if (isLoading) {
        return <div className="p-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-purple-600 animate-spin" /></div>;
    }

    // Group catalog items by category for preview
    const groupedProducts = catalogItems.filter(i => i.is_active !== false).reduce((acc, item) => {
        const cat = item.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-950 overflow-hidden">
            {/* LEFT PANE: Editor Controls */}
            <div className="w-full lg:w-[450px] xl:w-[500px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/merchant/settings')} className="h-8 w-8 rounded-full">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h1 className="font-bold text-lg">Storefront Builder</h1>
                            <p className="text-xs text-slate-500 line-clamp-1">{businessData?.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {storefront.status === 'published' && (
                            <Button variant="outline" size="sm" onClick={() => window.open(`/b/${storefront.slug}`, '_blank')}>
                                <Eye className="w-4 h-4 mr-1" /> View Live
                            </Button>
                        )}
                        <Button onClick={() => handleSave(true)} disabled={isSaving} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            {isSaving ? "Saving..." : (storefront.status === 'published' ? "Update Live" : "Publish")}
                        </Button>
                    </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="w-full grid grid-cols-6 mb-6 bg-slate-100 dark:bg-slate-800">
                            <TabsTrigger value="general" className="text-xs"><Edit3 className="w-3 h-3 mr-1" /> General</TabsTrigger>
                            <TabsTrigger value="design" className="text-xs"><LayoutTemplate className="w-3 h-3 mr-1" /> Design</TabsTrigger>
                            <TabsTrigger value="gallery" className="text-xs"><Camera className="w-3 h-3 mr-1" /> Gallery</TabsTrigger>
                            <TabsTrigger value="products" className="text-xs"><Package className="w-3 h-3 mr-1" /> Products</TabsTrigger>
                            <TabsTrigger value="contacts" className="text-xs"><LinkIcon className="w-3 h-3 mr-1" /> Socials</TabsTrigger>
                            <TabsTrigger value="marketing" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" /> Marketing</TabsTrigger>
                        </TabsList>

                        {/* ═══════ GENERAL TAB ═══════ */}
                        <TabsContent value="general" className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="text-purple-600 font-bold flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Your Public URL</Label>
                                <div className="flex items-center">
                                    <span className="bg-slate-200 dark:bg-slate-800 px-3 py-2 rounded-l-md text-sm text-slate-500 border border-r-0 border-slate-300 dark:border-slate-700">tagdeer.app/b/</span>
                                    <Input value={storefront.slug} onChange={e => setStorefront({ ...storefront, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="rounded-l-none font-mono text-sm" placeholder="my-business" />
                                </div>
                                <p className="text-[11px] text-slate-500">This is the unique link you share with customers and print on QR codes.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>SEO Page Title</Label>
                                <Input value={storefront.seo_metadata.title} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, title: e.target.value } })} placeholder="e.g. Best Coffee in Tripoli | The Roastery" />
                            </div>
                            <div className="space-y-2">
                                <Label>About Your Business</Label>
                                <Textarea value={storefront.description} onChange={e => setStorefront({ ...storefront, description: e.target.value })} placeholder="Tell customers what makes your business special..." className="min-h-[120px] resize-none" />
                            </div>
                        </TabsContent>

                        {/* ═══════ DESIGN TAB ═══════ */}
                        <TabsContent value="design" className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-purple-600" /> Brand Assets</Label>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">Logo Image</Label>
                                        <div className="flex gap-2">
                                            <Input value={storefront.logo_url} onChange={e => setStorefront({ ...storefront, logo_url: e.target.value })} placeholder="https://example.com/logo.png" className="flex-1" />
                                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => document.getElementById('logo-upload').click()} disabled={isUploading}><UploadCloud className="w-4 h-4" /></Button>
                                            <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, 'logo')} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">Banner Image</Label>
                                        <div className="flex gap-2">
                                            <Input value={storefront.banner_url} onChange={e => setStorefront({ ...storefront, banner_url: e.target.value })} placeholder="https://example.com/cover.png" className="flex-1" />
                                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => document.getElementById('banner-upload').click()} disabled={isUploading}><UploadCloud className="w-4 h-4" /></Button>
                                            <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, 'banner')} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Label className="font-bold">Theme Colors</Label>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Primary Color</Label>
                                    <div className="flex gap-2">
                                        <div className="w-10 h-10 rounded border shadow-sm shrink-0" style={{ backgroundColor: storefront.theme_config.primaryColor || '#10b981' }} />
                                        <Input type="text" value={storefront.theme_config.primaryColor} onChange={e => setStorefront({ ...storefront, theme_config: { ...storefront.theme_config, primaryColor: e.target.value } })} className="font-mono text-xs" />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ═══════ GALLERY TAB ═══════ */}
                        <TabsContent value="gallery" className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="font-bold flex items-center gap-2"><Camera className="w-4 h-4 text-purple-600" /> Image Gallery</Label>
                                <p className="text-xs text-slate-500">Upload or paste direct image links for your storefront gallery carousel.</p>
                                <div className="space-y-3 mt-4">
                                    {storefront.gallery_images.map((imgUrl, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            {imgUrl && (
                                                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-slate-200 border">
                                                    <img src={imgUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => { e.target.style.display = 'none' }} />
                                                </div>
                                            )}
                                            <Input value={imgUrl} onChange={e => { const newArr = [...storefront.gallery_images]; newArr[i] = e.target.value; setStorefront({ ...storefront, gallery_images: newArr }); }} placeholder="https://example.com/photo.jpg" className="flex-1" />
                                            <Button variant="ghost" size="icon" onClick={() => setStorefront({ ...storefront, gallery_images: storefront.gallery_images.filter((_, idx) => idx !== i) })} className="text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 mt-4">
                                        <Button variant="outline" className="flex-1 border-dashed text-slate-500 gap-2 h-12" onClick={() => document.getElementById('gallery-upload').click()} disabled={isUploading}>
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Upload from Device'}
                                        </Button>
                                        <Button variant="outline" disabled={isUploading} className="border-dashed text-slate-500 h-12 px-3" onClick={() => setStorefront({ ...storefront, gallery_images: [...storefront.gallery_images, ''] })}>+ URL</Button>
                                        <input id="gallery-upload" type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ═══════ PRODUCTS TAB ═══════ */}
                        <TabsContent value="products" className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-purple-600" /> Product Catalog</Label>
                                    <span className="text-xs text-slate-500">{catalogItems.length} items</span>
                                </div>

                                {!storefront.id && (
                                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                                        ⚠️ Save the storefront first before adding products.
                                    </div>
                                )}

                                {/* Product list */}
                                <div className="space-y-2">
                                    {catalogItems.map(item => (
                                        <div key={item.id} className="flex gap-3 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 group">
                                            {item.image_url && (
                                                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-200">
                                                    <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{item.name}</p>
                                                <div className="flex gap-2 text-xs text-slate-500">
                                                    {item.price > 0 && <span className="font-bold" style={{ color: storefront.theme_config.primaryColor }}>{item.price} LYD</span>}
                                                    {item.category && <span>• {item.category}</span>}
                                                    {item.sku && <span className="font-mono">• {item.sku}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingItem({ ...item })}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteProduct(item.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Edit / Add product form */}
                                {editingItem && (
                                    <div className="p-4 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-purple-600">{editingItem.id ? 'Edit Product' : 'New Product'}</Label>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(null)}><X className="w-4 h-4" /></Button>
                                        </div>
                                        <Input placeholder="Product Name *" value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                                        <Textarea placeholder="Description" value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} className="min-h-[60px] resize-none" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input type="number" step="0.01" placeholder="Price (LYD)" value={editingItem.price || ''} onChange={e => setEditingItem({ ...editingItem, price: e.target.value })} />
                                            <Input placeholder="Category" value={editingItem.category || ''} onChange={e => setEditingItem({ ...editingItem, category: e.target.value })} />
                                        </div>
                                        <Input placeholder="SKU (optional)" value={editingItem.sku || ''} onChange={e => setEditingItem({ ...editingItem, sku: e.target.value })} className="font-mono text-xs" />
                                        <div className="flex gap-2">
                                            <Input placeholder="Image URL" value={editingItem.image_url || ''} onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })} className="flex-1" />
                                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => document.getElementById('product-img-upload').click()} disabled={isUploading}><UploadCloud className="w-4 h-4" /></Button>
                                            <input id="product-img-upload" type="file" accept="image/*" className="hidden" onChange={handleProductImageUpload} />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleSaveProduct(editingItem)} className="bg-purple-600 hover:bg-purple-700 text-white flex-1">
                                                <Check className="w-4 h-4 mr-1" /> Save
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" className="flex-1 gap-2 h-11 border-dashed" onClick={() => setEditingItem({ name: '', price: '', category: '', sku: '', description: '', image_url: '' })} disabled={!storefront.id}>
                                        <Plus className="w-4 h-4" /> Add Product
                                    </Button>
                                    <Button variant="outline" className="flex-1 gap-2 h-11 border-dashed" onClick={() => setShowImportPanel(!showImportPanel)} disabled={!storefront.id}>
                                        <UploadCloud className="w-4 h-4" /> Import
                                    </Button>
                                </div>

                                {/* Import panel */}
                                {showImportPanel && (
                                    <div className="p-4 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 space-y-4">
                                        <Label className="font-bold text-blue-600">Import Products</Label>

                                        {/* CSV upload */}
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-500">Upload CSV File</Label>
                                            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => document.getElementById('csv-upload').click()}>
                                                <FileText className="w-4 h-4" /> Choose CSV File
                                            </Button>
                                            <input id="csv-upload" type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleCsvUpload} />
                                        </div>

                                        <div className="text-center text-xs text-slate-400 font-bold">OR</div>

                                        {/* URL feed */}
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-500">Paste Feed URL (XML, JSON, CSV)</Label>
                                            <div className="flex gap-2">
                                                <Input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://example.com/products.xml" className="flex-1" />
                                                <Button size="sm" onClick={handleFetchFeed} disabled={isImporting || !importUrl.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Preview */}
                                        {importPreview && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-bold">{importPreview.length} products found</Label>
                                                    <Button size="sm" onClick={handleBulkInsert} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                                                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                        Import All
                                                    </Button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto border rounded-lg bg-white dark:bg-slate-900">
                                                    {importPreview.slice(0, 10).map((p, i) => (
                                                        <div key={i} className="px-3 py-2 border-b last:border-0 text-xs flex justify-between">
                                                            <span className="font-bold truncate flex-1">{p.name}</span>
                                                            <span className="text-slate-500 shrink-0 ml-2">{p.price > 0 ? `${p.price} LYD` : '-'}</span>
                                                        </div>
                                                    ))}
                                                    {importPreview.length > 10 && <div className="px-3 py-2 text-xs text-slate-400 text-center">...and {importPreview.length - 10} more</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ═══════ SOCIALS TAB ═══════ */}
                        <TabsContent value="contacts" className="space-y-4 animate-in fade-in duration-300">
                            <p className="text-xs text-slate-500 mb-4">Contact details and social links displayed on your public storefront.</p>
                            <div className="space-y-2"><Label className="text-sm">Phone Number</Label><Input value={storefront.contact_overrides.phone} onChange={e => setStorefront({ ...storefront, contact_overrides: { ...storefront.contact_overrides, phone: e.target.value } })} placeholder="+218 9X XXX XXXX" /></div>
                            <div className="space-y-2"><Label className="text-sm">Website URL</Label><Input value={storefront.contact_overrides.website} onChange={e => setStorefront({ ...storefront, contact_overrides: { ...storefront.contact_overrides, website: e.target.value } })} placeholder="https://yourdomain.com" /></div>
                            <div className="space-y-2"><Label className="text-sm">Facebook Page URL</Label><Input value={storefront.contact_overrides.facebook} onChange={e => setStorefront({ ...storefront, contact_overrides: { ...storefront.contact_overrides, facebook: e.target.value } })} placeholder="https://facebook.com/yourpage" /></div>
                            <div className="space-y-2"><Label className="text-sm">Instagram Profile URL</Label><Input value={storefront.contact_overrides.instagram} onChange={e => setStorefront({ ...storefront, contact_overrides: { ...storefront.contact_overrides, instagram: e.target.value } })} placeholder="https://instagram.com/yourhandle" /></div>
                        </TabsContent>

                        {/* ═══════ MARKETING TAB ═══════ */}
                        <TabsContent value="marketing" className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> SEO & Search</Label>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Meta Description</Label>
                                    <Textarea value={storefront.seo_metadata.description} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, description: e.target.value } })} placeholder="A compelling description for Google search results..." className="min-h-[80px] resize-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">OG Image (Social Sharing)</Label>
                                    <Input value={storefront.seo_metadata.og_image || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, og_image: e.target.value } })} placeholder="https://example.com/og-image.jpg" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Google Search Console Verification ID</Label>
                                    <Input value={storefront.seo_metadata.search_console_id || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, search_console_id: e.target.value } })} placeholder="e.g. abc123XYZ" />
                                </div>

                                {/* SERP Preview */}
                                {(storefront.seo_metadata.title || storefront.seo_metadata.description) && (
                                    <div className="mt-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Google Preview</p>
                                        <p className="text-blue-700 dark:text-blue-400 text-lg font-medium truncate">{storefront.seo_metadata.title || businessData?.name || 'Page Title'}</p>
                                        <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">tagdeer.app/b/{storefront.slug}</p>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 line-clamp-2">{storefront.seo_metadata.description || 'Add a meta description...'}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="font-bold">Tracking & Retargeting Pixels</Label>
                                <p className="text-xs text-slate-500">Paste your pixel IDs below. Scripts auto-inject on your public storefront to build retargeting audiences.</p>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Meta Pixel ID (Facebook/Instagram)</Label>
                                    <Input value={storefront.seo_metadata.meta_pixel_id || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, meta_pixel_id: e.target.value } })} placeholder="e.g. 123456789012345" className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Google Ads Conversion ID</Label>
                                    <Input value={storefront.seo_metadata.google_ads_id || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, google_ads_id: e.target.value } })} placeholder="e.g. AW-123456789" className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Google Tag Manager Container ID</Label>
                                    <Input value={storefront.seo_metadata.gtm_id || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, gtm_id: e.target.value } })} placeholder="e.g. GTM-XXXXXXX" className="font-mono text-xs" />
                                </div>
                            </div>

                            <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <Label className="font-bold">WhatsApp CTA</Label>
                                <Input value={storefront.seo_metadata.whatsapp || ''} onChange={e => setStorefront({ ...storefront, seo_metadata: { ...storefront.seo_metadata, whatsapp: e.target.value } })} placeholder="+218 9X XXX XXXX" />
                                <p className="text-xs text-slate-500">Separate from phone. Used for the WhatsApp button on your page.</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* RIGHT PANE: Live Preview */}
            <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-[#f0f2f5] dark:bg-black/40 p-8 relative">
                <div className="absolute top-4 right-6 flex items-center gap-2 text-slate-400">
                    <Smartphone className="w-5 h-5" />
                    <span className="text-sm font-semibold tracking-wide uppercase">Live Device Preview</span>
                </div>

                <div className="w-[390px] h-[844px] bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border-[8px] border-slate-800 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50"><div className="w-40 h-full bg-slate-800 rounded-b-3xl"></div></div>

                    <div className="flex-1 overflow-y-auto no-scrollbar relative bg-slate-50 dark:bg-slate-950 pb-24">
                        {/* Banner */}
                        <div className="w-full h-48 bg-slate-200 dark:bg-slate-800 relative" style={{ backgroundImage: storefront.banner_url ? `url(${storefront.banner_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                            {!storefront.banner_url && <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Banner Image</div>}
                            <div className="absolute -bottom-10 left-6 w-24 h-24 rounded-full border-4 border-white dark:border-slate-950 bg-white dark:bg-slate-800 overflow-hidden shadow-sm flex items-center justify-center">
                                {storefront.logo_url ? <img src={storefront.logo_url} className="w-full h-full object-cover" alt="Logo" /> : <Store className="w-8 h-8 text-slate-300" />}
                            </div>
                        </div>

                        <div className="pt-14 px-6 space-y-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{businessData?.name || 'Your Business Name'}</h2>
                                <p className="font-semibold text-sm mt-1" style={{ color: storefront.theme_config.primaryColor }}>{businessData?.category || 'Category'} • {businessData?.region || 'City'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="py-2.5 rounded-xl text-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: storefront.theme_config.primaryColor }}>Call Now</div>
                                <div className="py-2.5 rounded-xl text-center bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Directions</div>
                            </div>

                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{storefront.description || 'Add a description...'}</p>

                            {/* Products Preview */}
                            {Object.keys(groupedProducts).length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-black mb-3 flex items-center gap-2"><span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: storefront.theme_config.primaryColor }} />Products</h3>
                                    {Object.entries(groupedProducts).map(([cat, items]) => (
                                        <div key={cat} className="mb-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{cat}</p>
                                            {items.slice(0, 3).map(item => (
                                                <div key={item.id} className="flex gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                    {item.image_url && <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-200"><img src={item.image_url} className="w-full h-full object-cover" alt="" /></div>}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate">{item.name}</p>
                                                        {item.price > 0 && <p className="text-xs font-black" style={{ color: storefront.theme_config.primaryColor }}>{item.price} LYD</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Gallery */}
                            {storefront.gallery_images?.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-black mb-3 flex items-center gap-2"><span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: storefront.theme_config.primaryColor }} />Gallery</h3>
                                    <div className="flex overflow-x-auto gap-3 pb-2 snap-x no-scrollbar">
                                        {storefront.gallery_images.filter(img => img.trim() !== '').map((imgUrl, i) => (
                                            <div key={i} className="snap-center shrink-0 w-40 h-28 rounded-2xl overflow-hidden shadow-sm border"><img src={imgUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} /></div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Health Stats */}
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm text-center">
                                    <div className="text-xl font-black text-emerald-500">{businessData?.recommends || 0}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">أنصح به</div>
                                </div>
                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm text-center">
                                    <div className="text-xl font-black text-rose-500">{businessData?.complains || 0}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">لا أنصح به</div>
                                </div>
                            </div>

                            {/* Review CTA */}
                            <div className="mt-6 p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border text-center space-y-3">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full mx-auto flex items-center justify-center">
                                    <Store className="w-6 h-6" />
                                </div>
                                <p className="font-bold">شاركنا تقديرك</p>
                                <div className="py-2 px-4 rounded-lg text-sm font-bold opacity-60 mx-auto max-w-[200px]" style={{ backgroundColor: storefront.theme_config.primaryColor, color: '#fff' }}>Leave a Review</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
