"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
    const router = useRouter();
    const { supabase, showToast } = useTagdeer();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password.length < 6) {
            showToast('Password must be at least 6 characters.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            // Also mark has_password = true in the profile so login detects it
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                await supabase
                    .from('profiles')
                    .update({ has_password: true })
                    .eq('id', authUser.id);
            }

            setSuccess(true);
            showToast('Password updated successfully!');
            setTimeout(() => router.push('/merchant/settings'), 2000);
        } catch (err) {
            console.error('Password update error:', err);
            showToast(err.message || 'Failed to update password.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
                    <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-black mb-3">Password Updated!</h2>
                <p className="text-slate-500 text-lg">Redirecting to settings...</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden relative">
                <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 absolute top-0 left-0"></div>

                <CardHeader className="pt-10 pb-6 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 border-indigo-100 dark:border-indigo-800">
                        <Lock className="w-7 h-7" />
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                        Set New Password
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-base mt-2">
                        Choose a strong password for your merchant account.
                    </CardDescription>
                </CardHeader>

                <CardContent className="pb-10 px-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    className="pl-10 pr-12 h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    className="pl-10 h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 text-lg rounded-xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xl"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Update Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
