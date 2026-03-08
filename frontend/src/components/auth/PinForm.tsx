"use client";

import { useState } from "react";
import { Lock, Unlock, User, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";

interface PinFormProps {
    mode: "verify" | "set" | "remove";
    user: { id: string; name: string };
    onSuccess: (userId: string) => void;
    onCancel: () => void;
}

export default function PinForm({ mode, user, onSuccess, onCancel }: PinFormProps) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const API_BASE = "/api";

    const getTitle = () => {
        switch (mode) {
            case "set": return "Set Secure PIN";
            case "remove": return "Disable Security";
            case "verify": return "Passcode Required";
        }
    };

    const getSubtitle = () => {
        switch (mode) {
            case "set": return `Create a 4-digit PIN for ${user.name} to protect sensitive data.`;
            case "remove": return "Enter your current PIN to disable security for this profile.";
            case "verify": return `Verification needed to access ${user.name}'s portfolio.`;
        }
    };

    const handleSubmit = async () => {
        if (!pin || pin.length !== 4) {
            setError("PIN must be exactly 4 digits");
            return;
        }

        setLoading(true);
        setError("");

        try {
            let endpoint = "";
            let method = "POST";

            if (mode === "set") endpoint = `${API_BASE}/users/${user.id}/set-pin`;
            else if (mode === "remove") endpoint = `${API_BASE}/users/${user.id}/remove-pin`;
            else endpoint = `${API_BASE}/users/${user.id}/verify-pin`;

            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                onSuccess(user.id);
            } else {
                setError(mode === "verify" || mode === "remove" ? "Incorrect PIN. Please try again." : "Failed to set PIN.");
            }
        } catch (err) {
            setError("Network connection error. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl p-10 w-full max-w-md mx-auto text-center relative overflow-hidden">
            {/* Header Lock Icon */}
            <div className="mb-8 relative inline-block">
                <div className={`p-5 rounded-[2rem] shadow-xl ${mode === 'remove' ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}>
                    {mode === "remove" ? <Unlock size={32} /> : <Lock size={32} />}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
                    <ShieldCheck size={12} className="text-white" />
                </div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                {getTitle()}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-[240px] mx-auto font-medium leading-relaxed">
                {getSubtitle()}
            </p>

            <div className="space-y-6">
                <input
                    type="password"
                    inputMode="numeric"
                    className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-white/5 rounded-2xl px-6 py-5 text-center tracking-[1.5em] text-3xl font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-800"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setPin(val);
                        if (val.length === 4) setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoFocus
                    placeholder="0000"
                />

                {error && (
                    <p className="text-rose-500 dark:text-rose-400 text-sm font-bold animate-in shake-in duration-300">
                        {error}
                    </p>
                )}

                <div className="flex flex-col gap-3 pt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || pin.length !== 4}
                        className={`w-full py-4 rounded-2xl font-bold transition-all shadow-xl text-base flex items-center justify-center disabled:opacity-50 ${mode === 'remove'
                                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                            }`}
                    >
                        {loading ? <RefreshCw className="animate-spin mr-2" size={20} /> : null}
                        {mode === "set" ? "Confirm & Save" : mode === "remove" ? "Disable Lock" : "Unlock Dashboard"}
                    </button>

                    <button
                        onClick={onCancel}
                        className="w-full py-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold transition-colors text-sm flex items-center justify-center"
                    >
                        <ArrowLeft className="mr-2" size={16} />
                        Go Back
                    </button>
                </div>
            </div>

            {/* Subtle User Indicator */}
            <div className="mt-10 flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <User size={12} />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                    {user.name}
                </span>
            </div>
        </div>
    );
}
