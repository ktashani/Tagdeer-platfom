"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Gift, XCircle, AlertCircle, Scan, Keyboard } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';
import { toast } from 'sonner';

export default function ScannerModal({ isOpen, onClose, businessId }) {
    const { user } = useTagdeer();
    const scannerRef = useRef(null);

    const [scanMode, setScanMode] = useState('qr'); // 'qr' or 'manual'
    const [otpCode, setOtpCode] = useState('');
    const [scanStatus, setScanStatus] = useState('scanning'); // scanning, processing, success, error
    const [scannedUserId, setScannedUserId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [showCoupons, setShowCoupons] = useState(false);

    useEffect(() => {
        let scanner = null;

        if (isOpen && scanStatus === 'scanning' && scanMode === 'qr') {
            // Small delay to ensure DOM element is ready for the scanner
            const timer = setTimeout(() => {
                scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                        aspectRatio: 1.0
                    },
          /* verbose= */ false
                );

                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            }, 100);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(console.error);
                }
            };
        }
    }, [isOpen, scanStatus, scanMode]);

    const onScanSuccess = async (decodedText, decodedResult) => {
        if (scannerRef.current) {
            scannerRef.current.clear();
        }

        setScanStatus('processing');

        try {
            // Extract the UUID from the URL or handle direct code
            let targetUserId;
            if (decodedText.includes('tagdeer.app/verify-user/t=')) {
                // New logic: Base64 Short-lived token
                const token = decodedText.split('verify-user/t=')[1];
                try {
                    const payload = JSON.parse(atob(token));
                    if (Date.now() > payload.exp) {
                        throw new Error('QR Code expired. Please ask the user to refresh their pass.');
                    }
                    targetUserId = payload.id;
                } catch (e) {
                    throw new Error(e.message.includes('expired') ? e.message : 'Invalid Tagdeer Token Format.');
                }
            } else if (decodedText.includes('tagdeer.app/verify-user/')) {
                // Legacy URL format
                targetUserId = decodedText.split('verify-user/')[1];
            } else if (decodedText.trim().length === 36) {
                // Raw UUID
                targetUserId = decodedText.trim();
            } else {
                throw new Error('Invalid Tagdeer QR Code format.');
            }

            setScannedUserId(targetUserId);

            const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');

            if (isDevEnv && targetUserId === 'mock-user-id') {
                // UI testing mock bypass
            } else {
                // 1. Log the interaction in the database
                const { error: logError } = await supabase
                    .from('business_interactions')
                    .insert({
                        business_id: businessId,
                        profile_id: targetUserId,
                        interaction_type: 'scan'
                    });

                if (logError) {
                    if (logError.code === '23505') {
                        // Unique violation (already scanned recently)
                        throw new Error('User has already been scanned here today.');
                    }
                    throw logError;
                }
            }

            setScanStatus('success');
            toast.success('Interaction logged successfully!');

        } catch (err) {
            console.error('Scan error:', err);
            setErrorMessage(err.message || 'Failed to process scan.');
            setScanStatus('error');
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!otpCode || otpCode.length < 5) {
            toast.error("Please enter a valid code.");
            return;
        }

        setScanStatus('processing');
        const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');

        if (isDevEnv) {
            // Simulate network call for manual OTP in dev
            setTimeout(() => {
                setScannedUserId("mock-user-id");
                setScanStatus('success');
                toast.success('Interaction logged successfully via dev code bypass!');
            }, 1000);
        } else {
            // In production, block mock bypass until we hook it up to real logic
            setTimeout(() => {
                setErrorMessage('Manual verification is currently unavailable.');
                setScanStatus('error');
            }, 500);
        }
    };

    const onScanFailure = (error) => {
        // html5-qrcode triggers this constantly while seeking a QR code. Ignore it to prevent console spam.
    };

    const handleReset = () => {
        setScanStatus('scanning');
        setScannedUserId(null);
        setErrorMessage('');
        setOtpCode('');
        setShowCoupons(false);
    };

    const handleAllocateCoupon = async (coupon) => {
        const couponName = coupon.offer_type === 'free_item' ? coupon.item_name : `${coupon.discount_value}${coupon.offer_type === 'percentage' ? '%' : ' LYD'} Off`;

        try {
            const { error: redemptionError } = await supabase
                .from('coupon_redemptions')
                .insert({
                    coupon_id: coupon.id,
                    profile_id: scannedUserId
                });

            if (redemptionError) {
                if (redemptionError.code === '23505') {
                    throw new Error('User already claimed this coupon.');
                }
                throw redemptionError;
            }

            toast.success(`Coupon "${couponName}" has been pushed to the user's wallet!`);
            onClose();
        } catch (err) {
            toast.error(err.message || "Failed to allocate coupon");
        }
    };

    const [realCoupons, setRealCoupons] = useState([]);
    const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);

    useEffect(() => {
        if (showCoupons && businessId) {
            const fetchCoupons = async () => {
                setIsLoadingCoupons(true);
                const { data, error } = await supabase
                    .from('merchant_coupons')
                    .select('*')
                    .eq('business_id', businessId)
                    .eq('status', 'active');

                if (!error && data) {
                    setRealCoupons(data);
                }
                setIsLoadingCoupons(false);
            };
            fetchCoupons();
        }
    }, [showCoupons, businessId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950">
                <DialogHeader>
                    <DialogTitle>Scan Tagdeer VIP Passport</DialogTitle>
                    <DialogDescription>
                        Reward your visitors and boost your interaction rate.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center min-h-[350px] w-full py-4">

                    {scanStatus === 'scanning' && (
                        <div className="w-full h-full flex flex-col">
                            {/* Mode Toggle */}
                            <div className="flex w-full items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-lg mb-6">
                                <button
                                    onClick={() => setScanMode('qr')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${scanMode === 'qr' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Scan className="w-4 h-4" /> QR Scan
                                </button>
                                <button
                                    onClick={() => setScanMode('manual')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${scanMode === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Keyboard className="w-4 h-4" /> Enter Code
                                </button>
                            </div>

                            {scanMode === 'qr' ? (
                                <div className="w-full flex justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800">
                                    <div id="reader" className="w-full max-w-[300px]" />
                                </div>
                            ) : (
                                <form onSubmit={handleManualSubmit} className="w-full flex flex-col items-center pt-8 animate-in fade-in duration-300">
                                    <p className="text-sm text-slate-500 mb-4 text-center">Ask the customer for their dynamically generated 6-digit VIP code.</p>
                                    <div className="flex gap-2 w-full max-w-[250px] mb-6">
                                        <Input
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. A49X-8M"
                                            className="text-center text-lg tracking-widest uppercase py-6 font-bold"
                                            maxLength={8}
                                        />
                                    </div>
                                    <Button type="submit" className="w-full max-w-[250px]" disabled={!otpCode}>
                                        Verify Code
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}

                    {scanStatus === 'processing' && (
                        <div className="flex flex-col items-center animate-pulse">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Verifying VIP ID...</p>
                        </div>
                    )}

                    {scanStatus === 'success' && (
                        <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Verification Successful!</h3>
                            <p className="text-slate-500 mb-6 font-medium">
                                VIP Customer acknowledged. +5 Trust Points awarded.
                            </p>

                            <div className="w-full space-y-3">
                                {!showCoupons ? (
                                    <>
                                        <Button
                                            onClick={() => setShowCoupons(true)}
                                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-11"
                                        >
                                            <Gift className="w-4 h-4 mr-2" />
                                            Push Instant Coupon
                                        </Button>

                                        <Button variant="outline" onClick={handleReset} className="w-full h-11">
                                            Scan Next Customer
                                        </Button>
                                    </>
                                ) : (
                                    <div className="w-full border rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300 bg-slate-50/50">
                                        <div className="p-3 bg-slate-100 border-b text-sm font-semibold text-slate-700">
                                            Select Active Campaign
                                        </div>
                                        {isLoadingCoupons ? (
                                            <div className="p-6 text-center text-slate-500">Loading active coupons...</div>
                                        ) : realCoupons.length === 0 ? (
                                            <div className="p-6 text-center text-slate-500 italic">No active coupons available.</div>
                                        ) : (
                                            realCoupons.map(coupon => {
                                                const couponName = coupon.offer_type === 'free_item' ? coupon.item_name : `${coupon.discount_value}${coupon.offer_type === 'percentage' ? '%' : ' LYD'} Off`;
                                                return (
                                                    <button
                                                        key={coupon.id}
                                                        onClick={() => handleAllocateCoupon(coupon)}
                                                        className="w-full flex items-center justify-between p-4 border-b last:border-0 hover:bg-indigo-50 transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Gift className="w-4 h-4" />
                                                            </div>
                                                            <span className="font-semibold text-slate-800">{couponName}</span>
                                                        </div>
                                                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 pointer-events-none">
                                                            {coupon.remaining_quantity} left
                                                        </Badge>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {scanStatus === 'error' && (
                        <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <XCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Scan Failed</h3>
                            <p className="text-slate-500 mb-6 max-w-[250px]">
                                {errorMessage}
                            </p>

                            <Button variant="outline" onClick={handleReset} className="w-full">
                                Try Again
                            </Button>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
}
