"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Layout, Zap, Save, RefreshCw, CheckCircle2 } from "lucide-react";

interface AnalysisPreferencesFormProps {
    userId: string;
    onSave?: () => void;
}

export default function AnalysisPreferencesForm({ userId, onSave }: AnalysisPreferencesFormProps) {
    const [activeTab, setActiveTab] = useState<"smart" | "advanced">("smart");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Wizard State
    const [wizardAnswers, setWizardAnswers] = useState({
        time_horizon_years: 5,
        drawdown_tolerance: "medium",
        cost_sensitivity: "medium",
        style_preference: "mixed",
        goal: "growth",
        diversification: "broad",
        priority: "outperform"
    });

    // Advanced State
    const [advancedSettings, setAdvancedSettings] = useState<any>({});

    const fetchPrefs = useCallback(async () => {
        try {
            const res = await fetch(`/api/users/${userId}/highlight-prefs`);
            if (res.ok) {
                const data = await res.json();
                setAdvancedSettings(data);
            }
        } catch (err) {
            console.error(err);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchPrefs();
        }
    }, [userId, fetchPrefs]);

    const handleWizardSubmit = async () => {
        setLoading(true);
        setMessage("");
        try {
            const res = await fetch(`/api/users/${userId}/highlight-prefs/wizard`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(wizardAnswers),
            });
            if (res.ok) {
                const data = await res.json();
                setAdvancedSettings(data);
                setMessage("Smart Setup applied successfully!");
                setTimeout(() => setMessage(""), 3000);
                setActiveTab("advanced");
                onSave?.();
            }
        } catch (err) {
            setMessage("Failed to apply wizard settings.");
        }
        setLoading(false);
    };

    const handleAdvancedSubmit = async () => {
        setLoading(true);
        setMessage("");
        try {
            const payload = { ...advancedSettings };
            // Clean up empty strings or NaN
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" || Number.isNaN(Number(payload[key]))) {
                    payload[key] = null;
                } else if (payload[key] !== null && key !== "risk_profile") {
                    payload[key] = Number(payload[key]);
                }
            });

            const res = await fetch(`/api/users/${userId}/highlight-prefs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setMessage("Advanced settings saved!");
                setTimeout(() => setMessage(""), 3000);
                onSave?.();
            }
        } catch (err) {
            setMessage("Failed to save advanced settings.");
        }
        setLoading(false);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                        <Settings size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Analysis Preferences</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure how the Intelligence Engine evaluates your funds</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-8 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                <button
                    onClick={() => setActiveTab("smart")}
                    className={`py-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center ${activeTab === "smart"
                        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        }`}
                >
                    <Zap size={18} className="mr-2" />
                    Smart Setup
                </button>
                <button
                    onClick={() => setActiveTab("advanced")}
                    className={`py-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center ${activeTab === "advanced"
                        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        }`}
                >
                    <Layout size={18} className="mr-2" />
                    Advanced Override
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/30">
                {activeTab === "smart" ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex gap-4">
                            <CheckCircle2 size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                Answer these 7 quick questions to automatically configure the Intelligence Engine thresholds to match your unique investment style and risk appetite.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                {
                                    q: "1. Time Horizon",
                                    d: "When do you plan to withdraw a significant portion?",
                                    key: "time_horizon_years",
                                    icon: "⏳",
                                    options: [
                                        { label: "Less than 3 years", value: 2 },
                                        { label: "3 to 7 years", value: 5 },
                                        { label: "More than 7 years", value: 10 }
                                    ]
                                },
                                {
                                    q: "2. Drawdown Tolerance",
                                    d: "If your portfolio dropped 20% in a month?",
                                    key: "drawdown_tolerance",
                                    icon: "📉",
                                    options: [
                                        { label: "Panic & sell (Low)", value: "low" },
                                        { label: "Wait and see (Medium)", value: "medium" },
                                        { label: "Buy more (High)", value: "high" }
                                    ]
                                },
                                {
                                    q: "3. Cost Sensitivity",
                                    d: "Willing to pay higher fees for active mgmt?",
                                    key: "cost_sensitivity",
                                    icon: "💰",
                                    options: [
                                        { label: "Highly sensitive", value: "high" },
                                        { label: "Moderate", value: "medium" },
                                        { label: "Low sensitivity", value: "low" }
                                    ]
                                },
                                {
                                    q: "4. Management Style",
                                    d: "Do you prefer index funds or fund managers?",
                                    key: "style_preference",
                                    icon: "⚖️",
                                    options: [
                                        { label: "Strictly Passive", value: "passive" },
                                        { label: "Mixed/Neutral", value: "mixed" },
                                        { label: "Strictly Active", value: "active" }
                                    ]
                                },
                                {
                                    q: "5. Primary Goal",
                                    d: "Investing for regular income or growth?",
                                    key: "goal",
                                    icon: "🎯",
                                    options: [
                                        { label: "Capital Growth", value: "growth" },
                                        { label: "Regular Income", value: "income" }
                                    ]
                                },
                                {
                                    q: "6. Diversification",
                                    d: "Broad diversification or focused bets?",
                                    key: "diversification",
                                    icon: "🧩",
                                    options: [
                                        { label: "Broad (Safer)", value: "broad" },
                                        { label: "Concentrated (Aggressive)", value: "concentrated" }
                                    ]
                                },
                                {
                                    q: "7. Performance Priority",
                                    d: "Beating market or avoiding losses?",
                                    key: "priority",
                                    icon: "🚀",
                                    options: [
                                        { label: "maximizing Outperformance", value: "outperform" },
                                        { label: "Protecting Downside", value: "protect" }
                                    ]
                                }
                            ].map((item) => (
                                <div key={item.key} className="space-y-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 transition-colors shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{item.icon}</span>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">{item.q}</label>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium px-1">{item.d}</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                        value={(wizardAnswers as any)[item.key]}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, [item.key]: e.target.value })}
                                    >
                                        {item.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleWizardSubmit}
                            disabled={loading}
                            className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/25 transition-all flex items-center justify-center disabled:opacity-70 text-base"
                        >
                            {loading ? <RefreshCw className="animate-spin mr-3" size={20} /> : <Zap className="mr-3" size={20} />}
                            Apply Smart Configuration
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-2">
                            Manually override specific thresholds used by the Intelligence Engine. Leave blank to use Global/Category defaults.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                            {[
                                { key: "expense_ratio_high", label: "Max Expense Ratio (%)", desc: "Warn if higher" },
                                { key: "expense_ratio_low", label: "Low Expense Ratio (%)", desc: "Highlight if lower" },
                                { key: "beta_high", label: "High Volatility (Beta)", desc: "Warn if beta exceeds" },
                                { key: "beta_low", label: "Low Volatility (Beta)", desc: "Highlight if beta below" },
                                { key: "concentration_top5_high", label: "Max Top 5 Weight (%)", desc: "Warn if higher" },
                                { key: "ytm_attractive", label: "Attractive YTM (%)", desc: "For debt funds" },
                                { key: "pe_discount_pct", label: "Value PE Discount (Ratio)", desc: "Example: 0.8 is 20% below category" },
                                { key: "cagr_rank_top", label: "Top Rank Threshold", desc: "Highlight if rank <= this" },
                                { key: "cagr_outperform_min", label: "Min Outperformance (%)", desc: "Requires this much above category avg" },
                                { key: "cagr_underperform_min", label: "Min Underperformance (%)", desc: "Warn if below category avg by this much" },
                            ].map((field) => (
                                <div key={field.key} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">{field.label}</label>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{field.desc}</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="Default"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all"
                                        value={advancedSettings[field.key] ?? ""}
                                        onChange={(e) => setAdvancedSettings({ ...advancedSettings, [field.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleAdvancedSubmit}
                            disabled={loading}
                            className="w-full py-4 mt-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center disabled:opacity-70 text-base"
                        >
                            {loading ? <RefreshCw className="animate-spin mr-3" size={20} /> : <Save className="mr-3" size={20} />}
                            Save Advanced Overrides
                        </button>
                    </div>
                )}

                {message && (
                    <div className="mt-8 p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-center text-sm font-bold border border-emerald-100 dark:border-emerald-500/20 shadow-sm animate-in zoom-in duration-300">
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
