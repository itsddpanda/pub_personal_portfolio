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

    const fetchData = async (showToast: boolean = false) => {
        try {
            setError(null);
            if (!polling) setLoading(true);

            const res = await getSchemeEnrichment(amfiCode);
            if (res) {
                setData(res);
                setPolling(false);
                setCountdown(null);
                clearTimeouts();
                if (showToast) toast.success("Intelligence data loaded!");
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
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Minor Variance</span>;
        }
        // Assuming 3 is failure
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Unverified Data</span>;
    };

    return (
        <div className="mb-10 space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200 px-1 drop-shadow-sm">Advanced Intelligence</h2>
                {renderValidationBadge()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Returns & Consistency Grid */}
                {data.performance && data.risk_metrics && (
                    <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Risk-Adjusted Performance</h3>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center gap-1 mb-1">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">CAGR</p>
                                    {data.performance.cagr_tooltip && (
                                        <span title={data.performance.cagr_tooltip} className="cursor-help flex items-center">
                                            <Info className="w-3 h-3 text-slate-400" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {data.performance[`cagr_${period}`] ? `${data.performance[`cagr_${period}`].toFixed(2)}%` : '-'}
                                </p>
                                {data.risk_metrics[`cat_avg_${period}`] && (
                                    <p className="text-[10px] text-slate-400 font-mono mt-1">Cat Avg: {data.risk_metrics[`cat_avg_${period}`].toFixed(2)}%</p>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-1 mb-1">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Volatility (Std Dev)</p>
                                    {data.risk_metrics.risk_std_dev_tooltip && (
                                        <span title={data.risk_metrics.risk_std_dev_tooltip} className="cursor-help flex items-center">
                                            <Info className="w-3 h-3 text-slate-400" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {data.risk_metrics[`risk_std_dev_${period}`] ? `${data.risk_metrics[`risk_std_dev_${period}`].toFixed(2)}%` : '-'}
                                </p>
                            </div>
                            <div className="text-indigo-900/10">
                                <div className="flex items-center gap-1 mb-1">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Sharpe Ratio</p>
                                    {data.risk_metrics.sharpe_ratio_tooltip && (
                                        <span title={data.risk_metrics.sharpe_ratio_tooltip} className="cursor-help flex items-center">
                                            <Info className="w-3 h-3 text-slate-400" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {data.risk_metrics[`sharpe_ratio_${period}`] ? data.risk_metrics[`sharpe_ratio_${period}`].toFixed(2) : '-'}
                                </p>
                            </div>
                            <div className="text-indigo-900/10">
                                <div className="flex items-center gap-1 mb-1">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Beta</p>
                                    {data.risk_metrics.beta_tooltip && (
                                        <span title={data.risk_metrics.beta_tooltip} className="cursor-help flex items-center">
                                            <Info className="w-3 h-3 text-slate-400" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {data.risk_metrics[`beta_${period}`] ? data.risk_metrics[`beta_${period}`].toFixed(2) : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Holdings Table */}
                {data.holdings && data.holdings.length > 0 && (
                    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/30">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Top 5 Holdings Allocation</h3>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {data.holdings.slice(0, 5).map((h: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{h.stock_name}</td>
                                            <td className="px-4 py-2 text-right font-mono font-medium text-slate-900 dark:text-slate-400">
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

            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-mono">Data intelligence generated on {new Date(data.fetched_at).toLocaleDateString()}</p>
            </div>
        </div>
    );
}

