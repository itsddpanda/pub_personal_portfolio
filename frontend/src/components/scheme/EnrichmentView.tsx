"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getSchemeEnrichment, RetryableError } from '@/lib/api';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, RefreshCcw, AlertTriangle, Clock, Info, CheckCircle2, TrendingUp, TrendingDown, ShieldCheck, Users, Briefcase, ChevronRight, Activity, Target } from 'lucide-react';

export function EnrichmentView({ amfiCode, onLoaded }: { amfiCode: string; onLoaded?: () => void }) {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<"1y" | "3y" | "5y">("1y");
    const [peerView, setPeerView] = useState<"performance" | "risk" | "fundamentals">("performance");
    const [holdingsView, setHoldingsView] = useState<"heaviest" | "increased" | "decreased">("heaviest");
    const toast = useToast();

    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = async (showToast: boolean = false, force: boolean = false) => {
        try {
            setError(null);
            if (!polling) setLoading(true);
            if (force) setLoading(true); // Always show spinner on force refresh

            const res = await getSchemeEnrichment(amfiCode, force);
            if (res) {
                setData(res);
                onLoaded?.();
                setPolling(false);
                setCountdown(null);
                clearTimeouts();
                if (showToast) toast.success(force ? "Data refreshed successfully!" : "Intelligence data loaded!");
            } else {
                setData(null);
            }
        } catch (err: any) {
            if (err instanceof RetryableError) {
                setPolling(true);
                startPollingCountdown(err.retryAfter);
            } else {
                console.error("Enrichment Fetch Error:", err);
                setError("Advanced metrics unavailable.");
                setPolling(false);
                setCountdown(null);
                clearTimeouts();
                if (showToast) toast.error("Failed to load intelligence data.");
            }
        } finally {
            setLoading(false);
        }
    };

    const clearTimeouts = () => {
        if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        pollingTimeoutRef.current = null;
        countdownIntervalRef.current = null;
    };

    const startPollingCountdown = (seconds: number) => {
        clearTimeouts();
        setCountdown(seconds);

        countdownIntervalRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        pollingTimeoutRef.current = setTimeout(() => {
            fetchData();
        }, seconds * 1000);
    };

    useEffect(() => {
        // Auto-fetch on mount. 
        // If data is ready, it loads. If 503, it starts polling!
        // We use an internal async IIFE because fetchData is wrapped in useCallback and might have stale closures
        // if we just blindly pass it in some cases, but here it's fine.
        fetchData(false, false);
        return clearTimeouts;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amfiCode]);

    if (loading && !data) {
        return (
            <div className="animate-pulse bg-slate-100 dark:bg-slate-800/20 h-32 rounded-3xl mb-10 border border-dashed border-slate-200 dark:border-white/5 flex items-center justify-center">
                <p className="text-xs text-slate-400">Loading Intelligence...</p>
            </div>
        );
    }

    if (!data && !polling) {
        return (
            <div className="mb-10 p-8 bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-indigo-900/10 dark:to-transparent rounded-3xl border border-indigo-200/50 dark:border-indigo-500/10 text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
                <Sparkles className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Unlock Fund Intelligence</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                    Analyze risk-adjusted returns, peer rankings, and detailed holdings for deep portfolio understanding.
                </p>
                <Button onClick={() => fetchData(true)} className="rounded-full px-8 shadow-lg">
                    Run Analysis
                </Button>
            </div>
        );
    }

    if (polling) {
        return (
            <div className="mb-10 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-lg text-center relative overflow-hidden">
                {/* Progress bar line at top */}
                <div className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (countdown || 0) * 1.6)}%` }}></div>

                <div className="relative mb-6 flex justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{countdown}s</span>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Analysis in Progress...</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-6">
                    We are crunching 3-year volatility metrics and cross-referencing industry peers.
                </p>

                <div className="flex justify-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        Est. {countdown}s remaining
                    </div>
                </div>

                <button
                    onClick={() => { clearTimeouts(); setPolling(false); }}
                    className="mt-6 text-xs text-slate-400 hover:text-rose-500 transition-colors"
                >
                    Cancel Analysis
                </button>
            </div>
        );
    }


    const renderValidationBadge = () => {
        const { validation_status } = data;
        if (validation_status === 1) {
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Data Verified</span>;
        }
        if (validation_status === 2) {
            return <span title="Minor data discrepancy (e.g., NAV difference ≤ 5% or data freshness > 30 days) compared to official records. Core analysis remains sound." className="cursor-help inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Minor Variance</span>;
        }
        if (validation_status === 3) {
            return <span title="Significant data discrepancy detected. NAV or fund name does not match official records." className="cursor-help inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Unverified Data</span>;
        }
        // Status 0 = Unvalidated (not enough data for cross-validation)
        return <span title="Validation checks could not run — awaiting cross-reference data." className="cursor-help inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Pending Validation</span>;
    };

    // Parse KBYI Insights
    let insights: any[] = [];
    if (data?.kbyi) {
        try {
            insights = JSON.parse(data.kbyi);
        } catch (e) {
            console.error("Failed to parse kbyi insights", e);
        }
    }

    // Determine primary asset class
    const isDebtFund = data?.debt_alloc > 50 || data?.yield_to_maturity != null;
    const isEquityFund = data?.equity_alloc > 50 || data?.pe != null;

    return (
        <div className="mb-10 space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200 px-1 drop-shadow-sm">Advanced Intelligence</h2>
                    <button
                        onClick={() => fetchData(true, true)}
                        disabled={loading || polling}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
                        title="Re-analyze Fund"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {renderValidationBadge()}
            </div>

            {/* Fund Overview Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">AUM (Cr)</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                        {data.aum_cr != null ? `₹${data.aum_cr.toLocaleString('en-IN')}` : '-'}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Expense Ratio</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                        {data.expense_ratio != null ? `${data.expense_ratio}%` : '-'}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Inception</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                        {data.inception_date ? new Date(data.inception_date).toLocaleDateString() : '-'}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Benchmark</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate" title={data.benchmark || '-'}>
                        {data.benchmark || '-'}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Riskometer</p>
                    {(() => {
                        const risk = data.riskometer || "";
                        let color = "text-slate-900 dark:text-slate-100";
                        if (risk.toLowerCase().includes("low to moderate")) color = "text-emerald-500 dark:text-emerald-400";
                        else if (risk.toLowerCase().includes("low")) color = "text-emerald-600 dark:text-emerald-500";
                        else if (risk.toLowerCase().includes("moderately high")) color = "text-orange-500 dark:text-orange-400";
                        else if (risk.toLowerCase().includes("very high")) color = "text-rose-600 dark:text-rose-500";
                        else if (risk.toLowerCase().includes("high")) color = "text-rose-500 dark:text-rose-400";
                        else if (risk.toLowerCase().includes("moderate")) color = "text-amber-500 dark:text-amber-400";

                        return (
                            <p className={`font-semibold text-xs ${color}`}>
                                {risk || '-'}
                            </p>
                        );
                    })()}
                </div>
            </div>

            {/* AI Insights (KBYI) */}
            {insights.length > 0 && insights.some(i => i[Object.keys(i)[0]]?.text) && (
                <div className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Key Highlights</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.map((insight, idx) => {
                            const key = Object.keys(insight)[0];
                            const content = insight[key];

                            if (!content || !content.text) return null;

                            const rawText = content.text as string;
                            const type = content.type || 'info';

                            // Determine icon based on key type and semantic type
                            let Icon = Info;
                            let iconColor = "text-slate-400";
                            let bgColor = "bg-slate-100 dark:bg-slate-800";

                            const lowKey = key.toLowerCase();

                            if (type === 'positive') {
                                Icon = TrendingUp;
                                iconColor = "text-emerald-500";
                                bgColor = "bg-emerald-100 dark:bg-emerald-900/30";
                            } else if (type === 'risk') {
                                Icon = Activity;
                                iconColor = "text-rose-500";
                                bgColor = "bg-rose-100 dark:bg-rose-900/30";
                            }

                            // Specific icon overrides
                            if (lowKey.includes('cost') || lowKey.includes('expense')) {
                                Icon = ShieldCheck;
                                iconColor = "text-sky-500";
                                bgColor = "bg-sky-100 dark:bg-sky-900/30";
                            } else if (lowKey.includes('concentration')) {
                                Icon = Target;
                                iconColor = "text-amber-500";
                                bgColor = "bg-amber-100 dark:bg-amber-900/30";
                            } else if (lowKey.includes('stability')) {
                                Icon = ShieldCheck;
                                iconColor = "text-emerald-500";
                                bgColor = "bg-emerald-100 dark:bg-emerald-900/30";
                            } else if (lowKey.includes('yield')) {
                                Icon = TrendingUp;
                                iconColor = "text-indigo-500";
                                bgColor = "bg-indigo-100 dark:bg-indigo-900/30";
                            }

                            return (
                                <div key={idx} className="flex gap-3 items-start bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <div className={`p-2 rounded-lg ${bgColor} shrink-0`}>
                                        <Icon className={`w-4 h-4 ${iconColor}`} />
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                        {rawText}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Risk & Performance Grid */}
                {data.performance && data.risk_metrics && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl p-6 transition-all hover:shadow-md dark:hover:bg-slate-900/80 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Risk-Adjusted Performance</h3>
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                {(["1y", "3y", "5y"] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        {p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            {/* Primary Metrics */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Returns */}
                                {data.performance?.[`returns_${period}`] != null && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[108px] flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            {data.performance?.returns_tooltip ? (
                                                <span title={data.performance.returns_tooltip} className="cursor-help flex items-center group">
                                                    <span className="text-xs text-slate-500 font-medium tracking-wide group-hover:text-indigo-500 transition-colors">Return</span>
                                                    <Info className="w-3.5 h-3.5 ml-1.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">Return</span>
                                            )}
                                            <span className={`text-sm font-bold font-mono ${data.performance[`returns_${period}`] >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {Number(data.performance[`returns_${period}`]).toFixed(2)}%
                                            </span>
                                        </div>
                                        {(data.risk_metrics[`cat_avg_${period}`] !== null || data.risk_metrics[`cat_max_${period}`] !== null) && (
                                            <div className="flex items-center gap-3 mt-2 border-t border-slate-200/50 dark:border-slate-700 pt-2">
                                                {data.risk_metrics[`cat_avg_${period}`] !== null && (
                                                    <p className="text-[10px] text-slate-500 font-mono">Avg: {Number(data.risk_metrics[`cat_avg_${period}`]).toFixed(2)}%</p>
                                                )}
                                                {data.risk_metrics[`cat_max_${period}`] !== null && (
                                                    <p className="text-[10px] text-slate-500 font-mono text-indigo-500/80 dark:text-indigo-400/80">Max: {Number(data.risk_metrics[`cat_max_${period}`]).toFixed(2)}%</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Volatility / Deviation */}
                                {data.risk_metrics?.[`risk_std_dev_${period}`] != null && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[108px] flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            {data.risk_metrics?.risk_std_dev_tooltip ? (
                                                <span title={data.risk_metrics.risk_std_dev_tooltip} className="cursor-help flex items-center group">
                                                    <span className="text-xs text-slate-500 font-medium tracking-wide group-hover:text-indigo-500 transition-colors">Volatility</span>
                                                    <Info className="w-3.5 h-3.5 ml-1.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">Volatility</span>
                                            )}
                                            <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                                                {Number(data.risk_metrics[`risk_std_dev_${period}`]).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-200/50 dark:border-slate-700 pt-2">
                                            Standard Deviation
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Secondary Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {/* Sharpe Ratio */}
                                {data.risk_metrics?.[`sharpe_ratio_${period}`] != null && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[108px] flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            {data.risk_metrics?.sharpe_ratio_tooltip ? (
                                                <span title={data.risk_metrics.sharpe_ratio_tooltip} className="cursor-help flex items-center group">
                                                    <span className="text-xs text-slate-500 font-medium tracking-wide group-hover:text-indigo-500 transition-colors">Sharpe</span>
                                                    <Info className="w-3.5 h-3.5 ml-1.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">Sharpe</span>
                                            )}
                                            <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                                                {Number(data.risk_metrics[`sharpe_ratio_${period}`]).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Sortino Ratio */}
                                {data.risk_metrics?.[`sortino_ratio_${period}`] != null && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[108px] flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            {data.risk_metrics?.sortino_ratio_tooltip ? (
                                                <span title={data.risk_metrics.sortino_ratio_tooltip} className="cursor-help flex items-center group">
                                                    <span className="text-xs text-slate-500 font-medium tracking-wide group-hover:text-indigo-500 transition-colors">Sortino</span>
                                                    <Info className="w-3.5 h-3.5 ml-1.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">Sortino</span>
                                            )}
                                            <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                                                {Number(data.risk_metrics[`sortino_ratio_${period}`]).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Beta */}
                                {data.risk_metrics?.[`beta_${period}`] != null && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[108px] flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            {data.risk_metrics?.beta_tooltip ? (
                                                <span title={data.risk_metrics.beta_tooltip} className="cursor-help flex items-center group">
                                                    <span className="text-xs text-slate-500 font-medium tracking-wide group-hover:text-indigo-500 transition-colors">Beta</span>
                                                    <Info className="w-3.5 h-3.5 ml-1.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">Beta</span>
                                            )}
                                            <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                                                {Number(data.risk_metrics[`beta_${period}`]).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Valuations & Fundamentals */}
                {((isEquityFund && (data.pe != null || data.pb != null)) || (isDebtFund && (data.yield_to_maturity != null || data.modified_duration != null))) && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl p-6 transition-all hover:shadow-md dark:hover:bg-slate-900/80 flex flex-col">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-6">
                            {isEquityFund ? "Valuation & Fundamentals" : "Debt Characteristics"}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {isEquityFund ? (
                                <>
                                    {data.pe != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">P/E Ratio</p>
                                            <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">{data.pe.toFixed(2)}</p>
                                            {data.cat_avg_pe != null && <p className="text-[10px] text-slate-400 mt-1 font-mono">Cat Avg: {data.cat_avg_pe.toFixed(2)}</p>}
                                        </div>
                                    )}
                                    {data.pb != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">P/B Ratio</p>
                                            <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">{data.pb.toFixed(2)}</p>
                                            {data.cat_avg_pb != null && <p className="text-[10px] text-slate-400 mt-1 font-mono">Cat Avg: {data.cat_avg_pb.toFixed(2)}</p>}
                                        </div>
                                    )}
                                    {data.dividend_yield != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">Div. Yield</p>
                                            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{data.dividend_yield.toFixed(2)}%</p>
                                        </div>
                                    )}
                                    {data.turnover_ratio != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">Turnover</p>
                                            <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">{data.turnover_ratio.toFixed(2)}%</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {data.yield_to_maturity != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">YTM</p>
                                            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{data.yield_to_maturity.toFixed(2)}%</p>
                                        </div>
                                    )}
                                    {data.modified_duration != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">Mod. Duration</p>
                                            <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">{data.modified_duration.toFixed(2)} yrs</p>
                                        </div>
                                    )}
                                    {data.avg_eff_maturity != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">Avg Maturity</p>
                                            <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">{data.avg_eff_maturity.toFixed(2)} yrs</p>
                                        </div>
                                    )}
                                    {data.avg_credit_quality_name != null && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 font-medium tracking-wide mb-1">Credit Qual.</p>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{data.avg_credit_quality_name}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Portfolio Composition (Holdings & Allocation) */}
                {(data.holdings?.length > 0 || data.equity_alloc != null) && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-md dark:hover:bg-slate-900/80">
                        <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Portfolio Composition</h3>
                            {/* Concentration Risk Badge */}
                            {data.holdings && data.holdings.length >= 5 && (
                                (() => {
                                    const top5Weight = data.holdings.slice(0, 5).reduce((acc: number, h: any) => acc + (h.weighting || 0), 0);
                                    if (top5Weight > 35) {
                                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title="Top 5 holdings exceed 35% of total portfolio."><AlertTriangle className="w-3 h-3" /> High Concentration</span>;
                                    } else if (top5Weight > 25) {
                                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Top 5 holdings exceed 25% of total portfolio."><AlertTriangle className="w-3 h-3" /> Mod. Concentration</span>;
                                    }
                                    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Well Diversified</span>;
                                })()
                            )}
                        </div>

                        <div className="p-6 flex flex-col gap-6">
                            {/* Asset Allocation & Market Cap Bar */}
                            <div className="space-y-5">
                                {(data.equity_alloc != null || data.debt_alloc != null || data.cash_alloc != null) && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            Asset Allocation
                                            {data.is_asset_normalized && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="Asset Allocation was normalized">
                                                    <AlertTriangle className="w-3 h-3" /> Normalized
                                                </span>
                                            )}
                                        </h4>
                                        <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            {data.equity_alloc > 0 && <div style={{ width: `${data.equity_alloc}%` }} className="bg-indigo-500" title={`Equity: ${data.equity_alloc}%`} />}
                                            {data.debt_alloc > 0 && <div style={{ width: `${data.debt_alloc}%` }} className="bg-sky-500" title={`Debt: ${data.debt_alloc}%`} />}
                                            {data.cash_alloc > 0 && <div style={{ width: `${data.cash_alloc}%` }} className="bg-emerald-500" title={`Cash: ${data.cash_alloc}%`} />}
                                            {data.other_alloc > 0 && <div style={{ width: `${data.other_alloc}%` }} className="bg-amber-500" title={`Other: ${data.other_alloc}%`} />}
                                        </div>
                                        <div className="flex gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {data.equity_alloc > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" />Equity: {data.equity_alloc}%</span>}
                                            {data.debt_alloc > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />Debt: {data.debt_alloc}%</span>}
                                            {data.cash_alloc > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Cash: {data.cash_alloc}%</span>}
                                            {data.other_alloc > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Other: {data.other_alloc}%</span>}
                                        </div>
                                    </div>
                                )}

                                {/* Market Cap Allocation */}
                                {isEquityFund && (data.large_cap_wt != null || data.mid_cap_wt != null || data.small_cap_wt != null) && (() => {
                                    const totalCap = (data.large_cap_wt || 0) + (data.mid_cap_wt || 0) + (data.small_cap_wt || 0) + (data.others_cap_wt || 0);
                                    const scaleCap = totalCap > 0 ? 100 / totalCap : 1;
                                    return (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                Market Cap
                                                {data.is_cap_normalized && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="Cap distribution was normalized">
                                                        <AlertTriangle className="w-3 h-3" /> Normalized
                                                    </span>
                                                )}
                                            </h4>
                                            <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                {data.large_cap_wt > 0 && <div style={{ width: `${data.large_cap_wt * scaleCap}%` }} className="bg-indigo-600" title={`Large Cap: ${data.large_cap_wt}%`} />}
                                                {data.mid_cap_wt > 0 && <div style={{ width: `${data.mid_cap_wt * scaleCap}%` }} className="bg-indigo-400" title={`Mid Cap: ${data.mid_cap_wt}%`} />}
                                                {data.small_cap_wt > 0 && <div style={{ width: `${data.small_cap_wt * scaleCap}%` }} className="bg-indigo-300" title={`Small Cap: ${data.small_cap_wt}%`} />}
                                                {data.others_cap_wt > 0 && <div style={{ width: `${data.others_cap_wt * scaleCap}%` }} className="bg-slate-400" title={`Other/Unclassified: ${data.others_cap_wt}%`} />}
                                            </div>
                                            <div className="flex flex-wrap gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                {data.large_cap_wt > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" />Large: {data.large_cap_wt}%</span>}
                                                {data.mid_cap_wt > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />Mid: {data.mid_cap_wt}%</span>}
                                                {data.small_cap_wt > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-300" />Small: {data.small_cap_wt}%</span>}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Sector Distribution Bar + Top Sectors Table */}
                                {(data.sectors?.length > 0 || data.holdings?.some((h: any) => h.sector && h.weighting)) && (() => {
                                    let allSectors: { name: string; weight: number; change_1m?: number }[] = [];

                                    if (data.sectors && data.sectors.length > 0) {
                                        allSectors = data.sectors
                                            .filter((s: any) => s.weighting > 0)
                                            .sort((a: any, b: any) => (b.weighting || 0) - (a.weighting || 0))
                                            .map((s: any) => ({ name: s.sector_name, weight: s.weighting || 0, change_1m: s.change_1m }));
                                    } else {
                                        const sectorMap: Record<string, number> = {};
                                        data.holdings.forEach((h: any) => {
                                            if (h.sector && h.weighting) {
                                                sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.weighting;
                                            }
                                        });
                                        allSectors = Object.entries(sectorMap)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([name, weight]) => ({ name, weight }));
                                    }

                                    const totalWeight = allSectors.reduce((acc, s) => acc + s.weight, 0);
                                    const scale = totalWeight > 0 ? 100 / totalWeight : 1;
                                    const colors = ["bg-indigo-600", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];
                                    const dotColors = ["bg-indigo-600", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];
                                    const topSectors = allSectors.slice(0, 5);

                                    return (
                                        <>
                                            {/* Distribution Bar */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    Sector Distribution
                                                    {data.is_sectors_normalized && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="Sector weight% was normalized">
                                                            <AlertTriangle className="w-3 h-3" /> Normalized
                                                        </span>
                                                    )}
                                                </h4>
                                                <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                    {allSectors.map((s, idx) => (
                                                        <div key={s.name} style={{ width: `${(s.weight * scale)}%` }} className={colors[idx % colors.length]} title={`${s.name}: ${s.weight.toFixed(2)}%`} />
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                    {allSectors.slice(0, 6).map((s, idx) => (
                                                        <span key={s.name} className="flex items-center gap-1">
                                                            <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                                                            {s.name}: {s.weight.toFixed(1)}%
                                                        </span>
                                                    ))}
                                                    {allSectors.length > 6 && (
                                                        <span className="text-slate-400 dark:text-slate-500">+{allSectors.length - 6} more</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Top Sectors Table */}
                                            <div className="mt-4">
                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Sectors</h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                            {topSectors.map((s, idx) => (
                                                                <tr key={s.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                    <td className="py-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[idx % dotColors.length]}`} />
                                                                        <span className="truncate max-w-[180px]">{s.name}</span>
                                                                    </td>
                                                                    <td className="py-2 text-right font-mono font-medium text-slate-900 dark:text-slate-200 w-[70px]">
                                                                        {s.weight.toFixed(2)}%
                                                                    </td>
                                                                    {s.change_1m != null && (
                                                                        <td className="py-2 text-right font-mono text-xs w-[60px]">
                                                                            <span className={s.change_1m > 0 ? "text-emerald-500" : s.change_1m < 0 ? "text-rose-500" : "text-slate-400"}>
                                                                                {s.change_1m > 0 ? '+' : ''}{s.change_1m.toFixed(2)}%
                                                                            </span>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Top Holdings */}
                            {data.holdings?.length > 0 && (() => {
                                const validHoldings = data.holdings.filter((h: any) => h.weighting != null);
                                let displayedHoldings = [...validHoldings];

                                if (holdingsView === 'heaviest') {
                                    displayedHoldings.sort((a, b) => (b.weighting || 0) - (a.weighting || 0));
                                } else if (holdingsView === 'increased') {
                                    displayedHoldings = displayedHoldings.filter(h => h.change_1m > 0).sort((a, b) => b.change_1m - a.change_1m);
                                } else if (holdingsView === 'decreased') {
                                    displayedHoldings = displayedHoldings.filter(h => h.change_1m < 0).sort((a, b) => a.change_1m - b.change_1m);
                                }

                                displayedHoldings = displayedHoldings.slice(0, 5);

                                return (
                                    <div className="mt-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                Top Holdings
                                                {data.is_holdings_normalized && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="Holding weight% was normalized">
                                                        <AlertTriangle className="w-3 h-3" /> Normalized
                                                    </span>
                                                )}
                                            </h4>
                                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0 self-start sm:self-auto">
                                                {(["heaviest", "increased", "decreased"] as const).map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => setHoldingsView(v)}
                                                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${holdingsView === v ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                    >
                                                        {v === 'heaviest' ? 'HEAVIEST' : v === 'increased' ? 'INCREASED' : 'DECREASED'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                    {displayedHoldings.length === 0 ? (
                                                        <tr><td colSpan={3} className="py-4 text-center text-slate-500 text-xs italic">No holdings found for this view.</td></tr>
                                                    ) : displayedHoldings.map((h: any, i: number) => (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{h.stock_name}</td>
                                                            <td className="py-2 pr-2 text-right font-mono font-medium text-slate-900 dark:text-slate-400 w-[60px]">
                                                                {h.weighting ? `${h.weighting.toFixed(2)}%` : '-'}
                                                            </td>
                                                            {(holdingsView === 'increased' || holdingsView === 'decreased') && (
                                                                <td className="py-2 text-right font-mono text-xs w-[60px]">
                                                                    <span className={h.change_1m > 0 ? "text-emerald-500" : h.change_1m < 0 ? "text-rose-500" : "text-slate-400"}>
                                                                        {h.change_1m > 0 ? '+' : ''}{h.change_1m.toFixed(2)}%
                                                                    </span>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-center sm:text-right">
                                            <Link href={`/drilldown/holdings/${amfiCode}`} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 uppercase tracking-widest inline-flex items-center gap-1 transition-colors">
                                                Explore All Holdings <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
                {/* Peer Comparison Table & Cost Drag */}
                {data.peers?.length > 0 && (() => {
                    const validPeers = data.peers.filter((p: any) => p.expense_ratio != null);
                    const hasExpenseRatio = data.peers.some((p: any) => p.expense_ratio != null);
                    const hasDebtMetrics = data.peers.some((p: any) => p.yield_to_maturity != null || p.modified_duration != null);
                    const hasTurnover = data.peers.some((p: any) => p.portfolio_turnover != null);

                    // Always sort peers by 1Y/3Y/5Y return
                    const sortedPeers = [...data.peers].sort((a: any, b: any) => {
                        const valA = a.cagr_1y ?? a.cagr_3y ?? a.cagr_5y ?? 0;
                        const valB = b.cagr_1y ?? b.cagr_3y ?? b.cagr_5y ?? 0;
                        return valB - valA;
                    });

                    return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-md dark:hover:bg-slate-900/80">
                            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Category Peers Comparison</h3>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0 overflow-x-auto overflow-y-hidden max-w-[100vw]">
                                        <button onClick={() => setPeerView('performance')} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${peerView === 'performance' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>PERFORMANCE</button>
                                        <button onClick={() => setPeerView('risk')} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${peerView === 'risk' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>RISK & COST</button>
                                        {hasDebtMetrics && (
                                            <button onClick={() => setPeerView('fundamentals')} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${peerView === 'fundamentals' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>DEBT METRICS</button>
                                        )}
                                    </div>
                                    {/* Cost Drag Badge */}
                                    {(() => {
                                        if (data.expense_ratio == null || validPeers.length === 0) return null;

                                        const peerMedian = [...validPeers]
                                            .sort((a: any, b: any) => a.expense_ratio - b.expense_ratio)
                                        [Math.floor(validPeers.length / 2)].expense_ratio;

                                        const delta = data.expense_ratio - peerMedian;

                                        if (delta > 0.1) {
                                            return (
                                                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-3 py-1.5 rounded-lg text-xs" title={`Your fund's expense ratio (${data.expense_ratio}%) is ${delta.toFixed(2)}% higher than the category median (${peerMedian.toFixed(2)}%). This creates a continuous performance drag.`}>
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                                    <span className="text-rose-700 dark:text-rose-400 font-medium">High Cost Drag Detected</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 font-medium min-w-[150px]">Fund Name</th>
                                            {peerView === 'performance' && (
                                                <>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">1Y Ret</th>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">3Y Ret</th>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">5Y Ret</th>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">10Y Ret</th>
                                                </>
                                            )}
                                            {peerView === 'risk' && (
                                                <>
                                                    {hasExpenseRatio && <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Expense %</th>}
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Volatility</th>
                                                    {hasTurnover && <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Turnover %</th>}
                                                </>
                                            )}
                                            {peerView === 'fundamentals' && hasDebtMetrics && (
                                                <>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">YTM</th>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Mod Duration</th>
                                                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Avg Maturity</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {sortedPeers.map((peer: any, i: number) => {
                                            const isHighlight = (peer.peer_isin === data.isin) || (peer.fund_name === data.scheme_name);
                                            return (
                                                <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${isHighlight ? 'bg-indigo-100/50 dark:bg-indigo-500/20 shadow-[inset_4px_0_0_0_theme(colors.indigo.500)]' : ''}`}>
                                                    <td className={`px-4 py-3 ${isHighlight ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        <div className={`whitespace-nowrap md:whitespace-normal ${isHighlight ? 'font-bold' : 'font-medium'}`} title={peer.fund_name}>
                                                            {peer.fund_name}
                                                            {isHighlight && (
                                                                <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-indigo-500 text-white rounded uppercase tracking-tighter">Current</span>
                                                            )}
                                                        </div>
                                                        {peer.peer_isin && peer.fund_name === 'Unknown Peer' && (
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5" title="Peer ISIN">ISIN: {peer.peer_isin}</div>
                                                        )}
                                                    </td>
                                                    {peerView === 'performance' && (
                                                        <>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.cagr_1y != null ? <span className={peer.cagr_1y > 0 ? "text-emerald-500" : peer.cagr_1y < 0 ? "text-rose-500" : ""}>{peer.cagr_1y.toFixed(2)}%</span> : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.cagr_3y != null ? <span className={peer.cagr_3y > 0 ? "text-emerald-500" : peer.cagr_3y < 0 ? "text-rose-500" : ""}>{peer.cagr_3y.toFixed(2)}%</span> : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.cagr_5y != null ? <span className={peer.cagr_5y > 0 ? "text-emerald-500" : peer.cagr_5y < 0 ? "text-rose-500" : ""}>{peer.cagr_5y.toFixed(2)}%</span> : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.cagr_10y != null ? <span className={peer.cagr_10y > 0 ? "text-emerald-500" : peer.cagr_10y < 0 ? "text-rose-500" : ""}>{peer.cagr_10y.toFixed(2)}%</span> : '-'}
                                                            </td>
                                                        </>
                                                    )}
                                                    {peerView === 'risk' && (
                                                        <>
                                                            {hasExpenseRatio && (
                                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                    {peer.expense_ratio != null ? `${peer.expense_ratio.toFixed(2)}%` : '-'}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.std_deviation != null ? `${peer.std_deviation.toFixed(2)}%` : '-'}
                                                            </td>
                                                            {hasTurnover && (
                                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                    {peer.portfolio_turnover != null ? `${peer.portfolio_turnover.toFixed(2)}%` : '-'}
                                                                </td>
                                                            )}
                                                        </>
                                                    )}
                                                    {peerView === 'fundamentals' && hasDebtMetrics && (
                                                        <>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.yield_to_maturity != null ? `${peer.yield_to_maturity.toFixed(2)}%` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.modified_duration != null ? `${peer.modified_duration.toFixed(2)}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                                {peer.avg_eff_maturity != null ? `${peer.avg_eff_maturity.toFixed(2)}` : '-'}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-center sm:text-right p-4 sm:p-6 pb-2 pt-0">
                                <Link href={`/drilldown/peers/${amfiCode}`} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 uppercase tracking-widest inline-flex items-center gap-1 transition-colors">
                                    Compare All Peers <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Fund Management */}
            {data.managers?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all">
                    <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Fund Managers</h3>
                    </div>
                    <div className="p-0">
                        <ul className="divide-y divide-slate-100 dark:divide-white/5">
                            {data.managers.map((m: any, idx: number) => {
                                // Calculate tenure string
                                let tenureStr = "Present";
                                if (m.start_date) {
                                    const sd = new Date(m.start_date);
                                    let ed = new Date();
                                    if (m.end_date) {
                                        ed = new Date(m.end_date);
                                        tenureStr = `${sd.getFullYear()} - ${ed.getFullYear()}`;
                                    } else {
                                        const diffTime = Math.abs(ed.getTime() - sd.getTime());
                                        const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
                                        const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
                                        tenureStr = `Since ${sd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${diffYears}y ${diffMonths}m)`;
                                    }
                                }

                                return (
                                    <li key={idx} className="flex flex-col sm:flex-row p-4 sm:p-6 sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-slate-100">{m.manager_name}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Briefcase className="w-3 h-3" /> {m.role || 'Fund Manager'}</p>
                                            </div>
                                        </div>
                                        <div className="sm:text-right shrink-0">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">Tenure</p>
                                            <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{tenureStr}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}


            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-mono">Data intelligence generated on {new Date(data.fetched_at).toLocaleDateString()}</p>
            </div>
        </div>
    );
}

