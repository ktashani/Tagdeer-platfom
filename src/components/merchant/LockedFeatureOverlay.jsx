"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Search, AlertCircle, ShieldAlert, Zap, Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function LockedFeatureOverlay({
    title = "Unlock Tagdeer Pro",
    description = "This feature is only available for Pro and Enterprise merchants.",
    icon: Icon = Lock
}) {
    const router = useRouter();
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-100/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-amber-200 dark:border-amber-800">
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px] mb-6">
                {description}
            </p>
            <Button
                onClick={() => router.push('/merchant/settings?tab=subscription')}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/20"
            >
                Upgrade to Pro
            </Button>
        </div>
    );
}

// Example usage components to be composed in the dashboard

export const DisputeButtonLocked = () => (
    <Button disabled variant="outline" className="opacity-50 cursor-not-allowed relative overflow-hidden group">
        <Lock className="w-4 h-4 mr-2 text-amber-500" />
        Dispute Receipt
    </Button>
);

export const MessageUserButtonLocked = () => (
    <Button disabled variant="secondary" className="opacity-50 cursor-not-allowed relative overflow-hidden w-full group">
        <Lock className="w-4 h-4 mr-2 text-amber-500" />
        Message User to Resolve
    </Button>
);

export const ProShieldToggle = ({ title, description, level }) => (
    <Card className="relative overflow-hidden group opacity-80 border-slate-200 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                    {level === 1 ? <ShieldAlert className="w-5 h-5 text-slate-400" /> : <ShieldAlert className="w-5 h-5 text-amber-400" />}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <div className="w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-full relative cursor-not-allowed">
                <div className="w-4 h-4 bg-slate-400 rounded-full absolute left-1 top-1"></div>
            </div>
        </CardHeader>
        <LockedFeatureOverlay
            title="Shields Locked"
            description="Upgrade to Pro to filter reviews and protect your business score."
        />
    </Card>
);
