"use client";

import { useState, useEffect } from "react";
import { X, Settings, Layout, Zap, Save, RefreshCw } from "lucide-react";

interface AnalysisPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export default function AnalysisPreferencesModal({ isOpen, onClose, userId }: AnalysisPreferencesModalProps) {
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

    useEffect(() => {
        if (isOpen && userId) {
            fetchPrefs();
        }
    }, [isOpen, userId]);

    const fetchPrefs = async () => {
        try {
            const res = await fetch(`/api/users/${userId}/highlight-prefs`);
            if (res.ok) {
                const data = await res.json();
                setAdvancedSettings(data);
                // We don't have the wizard answers saved directly, but we populate the advanced settings
            }
        } catch (err) {
            console.error(err);
        }
    };

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
            }
        } catch (err) {
            setMessage("Failed to save advanced settings.");
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Settings size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Analysis Preferences</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/50">
                    <button
                        onClick={() => setActiveTab("smart")}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === "smart"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            }`}
                    >
                        <Zap size={16} className="mr-2" />
                        Smart Setup
                    </button>
                    <button
                        onClick={() => setActiveTab("advanced")}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === "advanced"
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            }`}
                    >
                        <Layout size={16} className="mr-2" />
                        Advanced Override
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "smart" ? (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Answer these 7 quick questions to automatically configure the Intelligence Engine thresholds to match your investment style.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">1. Time Horizon</label>
                                    <p className="text-xs text-slate-500 mb-2">When do you plan to withdraw a significant portion of your investments?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.time_horizon_years}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, time_horizon_years: Number(e.target.value) })}
                                    >
                                        <option value={2}>Less than 3 years</option>
                                        <option value={5}>3 to 7 years</option>
                                        <option value={10}>More than 7 years</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">2. Drawdown Tolerance</label>
                                    <p className="text-xs text-slate-500 mb-2">If your portfolio dropped 20% in a month, what would you do?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.drawdown_tolerance}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, drawdown_tolerance: e.target.value })}
                                    >
                                        <option value="low">Panic & sell (Low tolerance)</option>
                                        <option value="medium">Wait and see (Medium tolerance)</option>
                                        <option value="high">Buy more (High tolerance)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">3. Cost Sensitivity</label>
                                    <p className="text-xs text-slate-500 mb-2">Are you willing to pay higher fees for active management?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.cost_sensitivity}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, cost_sensitivity: e.target.value })}
                                    >
                                        <option value="high">No, fees eat into returns (Highly sensitive)</option>
                                        <option value="medium">Yes, if returns justify it (Moderate)</option>
                                        <option value="low">Yes, I want the best managers (Low sensitivity)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">4. Active vs Passive Preference</label>
                                    <p className="text-xs text-slate-500 mb-2">Do you prefer index funds or fund managers picking stocks?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.style_preference}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, style_preference: e.target.value })}
                                    >
                                        <option value="passive">Strictly Passive (Index/ETF)</option>
                                        <option value="mixed">Mixed/Neutral</option>
                                        <option value="active">Strictly Active Management</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">5. Primary Goal</label>
                                    <p className="text-xs text-slate-500 mb-2">Are you investing primarily for regular income or long-term growth?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.goal}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, goal: e.target.value })}
                                    >
                                        <option value="growth">Long-term Capital Growth</option>
                                        <option value="income">Regular Income / Yield</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">6. Diversification</label>
                                    <p className="text-xs text-slate-500 mb-2">Do you prefer broad diversification or focused bets on fewer stocks?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.diversification}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, diversification: e.target.value })}
                                    >
                                        <option value="broad">Broad Diversification (Safer)</option>
                                        <option value="concentrated">Concentrated Bets (Higher Risk/Reward)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">7. Performance Priority</label>
                                    <p className="text-xs text-slate-500 mb-2">What is more important: Beating the market, or avoiding losses?</p>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        value={wizardAnswers.priority}
                                        onChange={(e) => setWizardAnswers({ ...wizardAnswers, priority: e.target.value })}
                                    >
                                        <option value="outperform">Maximizing Outperformance</option>
                                        <option value="protect">Protecting Downside</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleWizardSubmit}
                                disabled={loading}
                                className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : null}
                                Apply Smart Configuration
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Manually override specific thresholds used by the Intelligence Engine. Leave blank to use Global/Category defaults.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <div key={field.key} className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{field.label}</label>
                                        <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">{field.desc}</p>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Default"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                            value={advancedSettings[field.key] ?? ""}
                                            onChange={(e) => setAdvancedSettings({ ...advancedSettings, [field.key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleAdvancedSubmit}
                                disabled={loading}
                                className="w-full py-3 mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-medium transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                                Save Advanced Overrides
                            </button>
                        </div>
                    )}

                    {message && (
                        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-center text-sm font-medium">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
