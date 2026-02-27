"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardSummary, getSyncStatus, syncNavs } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Holding {
    scheme_name: string;
    isin: string;
    amfi_code?: string;
    units: number;
    current_nav: number;
    current_value: number;
    invested_value: number;
    is_estimated: boolean;
}

interface SummaryData {
    total_value: number;
    invested_value: number;
    xirr: number;
    latest_nav_date: string | null;
    holdings: Holding[];
    has_estimated_holdings: boolean;
    estimated_schemes_count: number;
    total_stamp_duty: number;
    nav_sync_status: string;
    nav_sync_last_run: string | null;
}

import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

export default function DashboardPage() {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showEstimatedBanner, setShowEstimatedBanner] = useState(true);
    const router = useRouter();
    const toast = useToast();

    const syncingRef = useRef(syncing);
    useEffect(() => {
        syncingRef.current = syncing;
    }, [syncing]);

    const fetchData = React.useCallback(async (userId: string) => {
        try {
            const result = await getDashboardSummary(userId);
            setData(result);
        } catch (error) {
            console.error("Failed to fetch dashboard", error);
            toast.error("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) {
            router.push('/');
            return;
        }

        // Check if we just landed here from a successful CAS upload
        const pendingMsgs = sessionStorage.getItem('upload_success_messages');
        if (pendingMsgs) {
            try {
                const msgs = JSON.parse(pendingMsgs);
                msgs.forEach((msg: string) => toast.success(msg));
            } catch (e) {
                // Ignore parse errors safely
            }
            sessionStorage.removeItem('upload_success_messages');
        }

        fetchData(userId);

        // Dynamic polling interval
        let pollTimeout: NodeJS.Timeout;

        const poll = async () => {
            try {
                const status = await getSyncStatus();

                // If it just finished syncing, refresh data
                if (syncingRef.current && !status.is_syncing && userId) {
                    await fetchData(userId);
                }

                setSyncing(status.is_syncing);

                // Smart polling: every 5s if active, 60s if idle
                const nextInterval = status.is_syncing ? 5000 : 60000;
                pollTimeout = setTimeout(poll, nextInterval);

            } catch (e) {
                // Ignore polling errors silently, retry in 60s
                pollTimeout = setTimeout(poll, 60000);
            }
        };

        // Start initial poll
        poll();

        return () => clearTimeout(pollTimeout);
    }, [router, fetchData, toast]);


    const handleForceSync = async () => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) return;

        try {
            setSyncing(true);
            await syncNavs(userId);
            toast.success("NAV Sync initiated. Refreshing automatically...");
            // Notice: fetchData() is explicitly NOT called here.
            // The polling loop (useEffect) immediately detects the sync is running (is_syncing=true)
            // and will automatically fetch the new data when it flips back to false.
        } catch (e) {
            toast.error("Failed to initiate NAV sync.");
            setSyncing(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400 mt-20 animate-pulse">Loading Portfolio...</div>;
    }

    if (!data) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6 bg-transparent">
                <Card title="Welcome to Portfolio Analyzer" className="max-w-md w-full text-center border bg-white dark:bg-slate-900 shadow-xl">
                    <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                        No portfolio data found. Upload your Consolidated Account Statement (CAS) to get started.
                    </p>
                    <div className="flex justify-center">
                        <Button onClick={() => router.push('/upload')}>
                            Upload CAS
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const { total_value, invested_value, xirr, latest_nav_date, holdings, total_stamp_duty } = data;
    const gain = total_value - invested_value;
    const gainPercent = invested_value > 0 ? (gain / invested_value) * 100 : 0;

    const isStale = latest_nav_date && (new Date().getTime() - new Date(latest_nav_date).getTime() > 3 * 24 * 60 * 60 * 1000);
    const navSyncFailed = data.nav_sync_status === "FAILED";
    const isCriticalStale = isStale && navSyncFailed;

    return (
        <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-transparent">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/90 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-lg gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Portfolio Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-3">
                        {syncing ? (
                            <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/20">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Syncing NAVs...
                            </div>
                        ) : (
                            <div className={`text-sm font-medium px-3 py-1.5 rounded-full border bg-slate-50 dark:bg-slate-950/50 ${isStale ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/20' : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5'}`}>
                                {navSyncFailed && <span className="text-red-500 dark:text-red-400 mr-2" title="Background sync failed">⚠️</span>}
                                {latest_nav_date ? `Latest NAV Date: ${new Date(latest_nav_date).toLocaleDateString()}` : "Latest NAV Date: Pending"}
                            </div>
                        )}
                        <Button variant="outline" onClick={handleForceSync} disabled={syncing}>
                            {syncing ? 'Syncing...' : 'Force Sync'}
                        </Button>
                        <Button variant="secondary" onClick={() => router.push('/upload')}>
                            Upload CAS
                        </Button>
                    </div>
                </div>

                {/* Critical Failure Banner */}
                {isCriticalStale && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
                        <span className="text-red-500 dark:text-red-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
                        <div className="flex-1">
                            <h3 className="text-red-700 dark:text-red-400 font-semibold mb-1">Critical Failure: Market Data Outdated</h3>
                            <p className="text-red-600 dark:text-red-300/80 text-sm leading-relaxed">
                                Your portfolio NAVs are older than 3 days and background sync has failed. Valuations may be incorrect.
                            </p>
                        </div>
                    </div>
                )}

                {/* Estimated Holdings Warning Banner */}
                {data.has_estimated_holdings && showEstimatedBanner && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
                        <span className="text-amber-500 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
                        <div className="flex-1">
                            <p className="text-amber-700 dark:text-amber-300/90 text-sm font-medium leading-relaxed">
                                {data.estimated_schemes_count} holding{data.estimated_schemes_count > 1 ? 's were' : ' was'} carried forward without full transaction history. Invested Value may be understated.
                            </p>
                            <button onClick={() => router.push('/upload')}
                                className="text-amber-600 dark:text-amber-400 underline decoration-amber-500/30 underline-offset-4 text-sm mt-2 hover:text-amber-500 dark:hover:text-amber-300 transition-colors">
                                Upload a full-history CAS to fix this →
                            </button>
                        </div>
                        <button onClick={() => setShowEstimatedBanner(false)} className="text-amber-500/50 hover:text-amber-400 flex-shrink-0 text-lg p-1 transition-colors">
                            ✕
                        </button>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <Card title="Current Value" href="/drilldown/current-value">
                        <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400 drop-shadow-sm">₹{total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </Card>
                    <Card title="Invested Value" href="/drilldown/invested-value">
                        <p className="text-4xl font-bold text-slate-800 dark:text-slate-200">₹{invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        {total_stamp_duty > 0 && (
                            <p className="text-xs text-slate-500 mt-2 font-medium">Stamp duty: ₹{total_stamp_duty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        )}
                    </Card>
                    <Card title="Total Gain" href="/drilldown/total-gain">
                        <p className={`text-4xl font-bold ${gain >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                            ₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            <span className={`text-sm ml-2 font-medium px-2 py-0.5 rounded-md ${gain >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                ({gainPercent > 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                            </span>
                        </p>
                    </Card>
                    <Card title="XIRR" href="/drilldown/xirr">
                        <p className={`text-4xl font-bold ${xirr >= 0 ? 'text-violet-600 dark:text-violet-400 drop-shadow-[0_0_12px_rgba(167,139,250,0.3)]' : 'text-rose-500 dark:text-rose-400'}`}>
                            {xirr.toFixed(2)}%
                        </p>
                    </Card>
                </div>

                {/* Holdings Table */}
                <Card title="Holdings" className="overflow-hidden p-0 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm dark:shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th className="px-6 py-4 rounded-tl-xl whitespace-nowrap">Scheme</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Units</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">NAV</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Current Value</th>
                                    <th className="px-6 py-4 text-right rounded-tr-xl whitespace-nowrap">Invested Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {holdings.map((h) => (
                                    <tr key={h.isin} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <Link href={h.amfi_code ? `/scheme/${h.amfi_code}` : '#'} className="text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 block truncate max-w-[200px] sm:max-w-xs md:max-w-md xl:max-w-xl transition-colors" title={h.scheme_name}>
                                                {h.scheme_name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono">{h.units.toFixed(3)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono">₹{h.current_nav.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 dark:text-indigo-300 text-right font-semibold font-mono bg-indigo-50/50 dark:bg-indigo-500/[0.02]">₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                            <span className="text-slate-700 dark:text-slate-300 font-mono">₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                            {h.is_estimated && (
                                                <button
                                                    onClick={() => router.push('/holdings/estimated')}
                                                    className="ml-2 hover:opacity-70 transition-opacity bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-xs"
                                                    title="Estimated Cost (Partial History)"
                                                >
                                                    ⚠️ Est.
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {holdings.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-500">
                                            No active holdings found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>
        </div>
    );
}
