"use client";

import React, { useEffect, useState, useRef } from 'react';
import { getSchemeEnrichment, RetryableError } from '@/lib/api';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, RefreshCcw, AlertTriangle, Clock, Info } from 'lucide-react';

export function EnrichmentView({ amfiCode }: { amfiCode: string }) {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<"1y" | "3y" | "5y">("3y");
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
        // Only auto-fetch if we ALREADY have data cached/saved in the DB 
        // We will do a quick check to see if it exists
        const checkExisting = async () => {
            try {
                const res = await getSchemeEnrichment(amfiCode);
                if (res) setData(res);
            } catch (e) {
                // Ignore errors on background check
            } finally {
                setLoading(false);
            }
        };
        checkExisting();
        return clearTimeouts;
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
        // Assuming 3 is failure
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Unverified Data</span>;
    };

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
                            {/* Asset Allocation Bar */}
                            {(data.equity_alloc != null || data.debt_alloc != null || data.cash_alloc != null) && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Asset Allocation</h4>
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

                            {/* Top Holdings */}
                            {data.holdings?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Holdings</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                {data.holdings.slice(0, 5).map((h: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="py-2 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{h.stock_name}</td>
                                                        <td className="py-2 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                            {h.weighting ? `${h.weighting.toFixed(2)}%` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Peer Comparison Table & Cost Drag */}
                {data.peers?.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-md dark:hover:bg-slate-900/80">
                        <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Category Peers Comparison</h3>
                            {/* Cost Drag Badge */}
                            {(() => {
                                if (data.expense_ratio == null || data.peers.length === 0) return null;
                                const validPeers = data.peers.filter((p: any) => p.expense_ratio != null);
                                if (validPeers.length === 0) return null;

                                const peerMedian = [...validPeers]
                                    .sort((a: any, b: any) => a.expense_ratio - b.expense_ratio)
                                [Math.floor(validPeers.length / 2)].expense_ratio;

                                const delta = data.expense_ratio - peerMedian;

                                if (delta > 0.1) {
                                    return (
                                        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-3 py-1.5 rounded-lg text-xs" title={`Your fund's expense ratio (${data.expense_ratio}%) is ${delta.toFixed(2)}% higher than the category median (${peerMedian.toFixed(2)}%). This creates a continuous performance drag.`}>
                                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                                            <span className="text-rose-700 dark:text-rose-400 font-medium">High Cost Drag Detected</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Fund Name</th>
                                        <th className="px-4 py-3 font-medium text-right cursor-help" title="Lower is better. A high expense ratio significantly reduces your net returns over time.">Expense %</th>
                                        <th className="px-4 py-3 font-medium text-right cursor-help" title="Higher is better. Computed equivalent annual growth rate over 3 years.">3Y Return</th>
                                        <th className="px-4 py-3 font-medium text-right cursor-help" title="Lower is better. Measures how much the fund's returns fluctuate.">Volatility</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {/* Sort peers by 3Y return descending */}
                                    {data.peers.sort((a: any, b: any) => (b.return_3y || 0) - (a.return_3y || 0)).map((peer: any, i: number) => {
                                        // Logic to highlight if a peer is strictly better (cheaper AND higher return than the scheme itself if that data was available at parent level)
                                        // Here we just render the raw peer data cleanly.
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    <div className="font-medium whitespace-nowrap md:whitespace-normal" title={peer.fund_name}>{peer.fund_name}</div>
                                                    {peer.peer_isin && peer.fund_name === 'Unknown Peer' && (
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5" title="Peer ISIN">ISIN: {peer.peer_isin}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                    {peer.expense_ratio != null ? `${peer.expense_ratio.toFixed(2)}%` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400 block sm:table-cell">
                                                    {peer.return_3y != null ? (
                                                        <span className={peer.return_3y > 0 ? "text-emerald-500" : peer.return_3y < 0 ? "text-rose-500" : ""}>
                                                            {peer.return_3y.toFixed(2)}%
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
                                                    {peer.std_deviation != null ? `${peer.std_deviation.toFixed(2)}%` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>


            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-mono">Data intelligence generated on {new Date(data.fetched_at).toLocaleDateString()}</p>
            </div>
        </div>
    );
}

