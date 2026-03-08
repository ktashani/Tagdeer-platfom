"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

/**
 * SetPasswordPrompt — shown after a merchant's first OTP login.
 * Prompts them to create a password so they can skip OTP next time.
 *
 * Props:
 *  - onSetPassword(password): async function to set the password
 *  - onSkip(): function to dismiss the prompt
 */
export default function SetPasswordPrompt({ onSetPassword, onSkip }) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isValid =
        password.length >= 8 && password === confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await onSetPassword(password);
            toast.success("Password set successfully! Redirecting...");
            // Give a brief moment for the toast to show, then redirect
            setTimeout(() => {
                if (onSkip) onSkip();
            }, 1000);
        } catch (err) {
            toast.error(err.message || "Failed to set password");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden relative">
                {/* Decorative top bar */}
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 absolute top-0 left-0" />

                <CardHeader className="pt-10 pb-4 text-center">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                        Secure Your Account
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-base mt-2">
                        Set a password so you can log in instantly next time — no
                        email code needed.
                    </CardDescription>
                </CardHeader>

                <CardContent className="pb-10 px-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="At least 8 characters"
                                    className="h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg pr-12"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    id="set-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="Re-enter your password"
                                    className="h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg pr-12"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    required
                                    minLength={8}
                                    id="confirm-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    tabIndex={-1}
                                >
                                    {showConfirm ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-sm text-red-500 mt-1">
                                    Passwords do not match
                                </p>
                            )}
                        </div>

                        {/* Password strength hint */}
                        {password.length > 0 && password.length < 8 && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                {8 - password.length} more character
                                {8 - password.length > 1 ? "s" : ""} needed
                            </p>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-14 text-lg rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                            disabled={isLoading || !isValid}
                            id="set-password-submit"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                <>
                                    Set Password{" "}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onSkip}
                            className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            id="skip-password"
                        >
                            Skip for now
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
