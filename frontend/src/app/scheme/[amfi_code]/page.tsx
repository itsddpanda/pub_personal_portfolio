"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSchemeDetails, getSchemeHistory } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { NAVChart } from '@/components/charts/NAVChart';
import { EnrichmentView } from '@/components/scheme/EnrichmentView';

interface NAVDataPoint {
    date: string;
    nav: number;
}

interface SchemeMeta {
    name: string;
    amfi_code: string;
    isin: string;
    fund_house: string;
    category: string;
    type: string;
    latest_nav: number;
    latest_nav_date: string;
}

interface SchemeKPIs {
    invested_value: number;
    current_value: number;
    units: number;
    xirr?: number;
    xirr_status?: string;
    stamp_duty?: number;
}

interface TransactionRow {
    id: string;
    date: string;
    type: string;
    amount: number;
    nav: number;
    units: number;
    running_balance: number;
}

interface SchemeData {
    scheme: SchemeMeta;
    kpis: SchemeKPIs;
    ledger: TransactionRow[];
}

export default function SchemeDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const amfiCode = params.amfi_code as string;

    const [data, setData] = useState<SchemeData | null>(null);
    const [historyData, setHistoryData] = useState<NAVDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) {
            router.push('/');
            return;
        }

        const fetchDetails = async () => {
            try {
                const res = await getSchemeDetails(amfiCode, userId);
                if (res) {
                    setData(res);
                } else {
                    setError("Scheme not found in your portfolio.");
                }
            } catch (err: any) {
                setError(err.message || "Failed to fetch scheme details.");
            } finally {
                setLoading(false);
            }
        };

        const fetchHistory = async () => {
            setHistoryLoading(true);
            try {
                const res = await getSchemeHistory(amfiCode);
                if (res && res.data) {
                    setHistoryData(res.data);
                }
            } catch (err: any) {
                console.error("Failed to fetch history:", err);
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchDetails();
        fetchHistory();
    }, [amfiCode, router]);

    const handleRefreshHistory = async () => {
        setHistoryLoading(true);
        try {
            // Hitting the backfill endpoint explicitly (assuming it exists, otherwise just re-fetch)
            const res = await fetch(`/api/scheme/${amfiCode}/backfill`, { method: 'POST' });
            if (res.ok) {
                const historyRes = await getSchemeHistory(amfiCode);
                if (historyRes && historyRes.data) {
                    setHistoryData(historyRes.data);
                }
            }
        } catch (err) {
            console.error("Failed to refresh history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh] bg-transparent">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Button variant="outline" onClick={() => router.back()} className="mb-6 rounded-full px-6 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    &larr; Return to Dashboard
                </Button>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-8 shadow-sm">
                    <p className="text-red-500 dark:text-red-400 font-medium">{error || "No data available."}</p>
                </div>
            </div>
        );
    }

    const { scheme, kpis, ledger } = data;

    // Derived Analytics
    const absGain = kpis.current_value - kpis.invested_value;
    const absPercent = kpis.invested_value > 0 ? (absGain / kpis.invested_value) * 100 : 0;
    const isGain = absGain >= 0;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-transparent">
            <button
                onClick={() => router.back()}
                className="group flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-8 transition-colors"
            >
                <span className="mr-2 transform group-hover:-translate-x-1 transition-transform text-indigo-600 dark:text-indigo-500">&larr;</span>
                Back to Dashboard
            </button>

            {/* Premium Hero Header */}
            <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 mb-8 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl relative overflow-hidden">
                {/* Decorative subtle gradient background */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] uppercase font-bold tracking-widest rounded-full border border-slate-200 dark:border-white/5">
                                {scheme.fund_house || "Unknown AMC"}
                            </span>
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold tracking-widest rounded-full border border-indigo-200 dark:border-indigo-500/20">
                                {scheme.category || "Equity"}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mb-2 text-balance lg:max-w-[90%]">
                            {scheme.name}
                        </h1>
                        <p className="text-sm font-mono text-slate-500 mt-2">
                            ISIN: {scheme.isin} <span className="mx-2 opacity-30 text-slate-400">•</span> AMFI: <span className="text-slate-500 dark:text-slate-400">{scheme.amfi_code}</span>
                        </p>
                    </div>

                    <div className="text-left md:text-right bg-slate-50 dark:bg-slate-950/50 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">Latest NAV</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-200 font-mono tracking-tight drop-shadow-sm">
                            ₹{scheme.latest_nav ? scheme.latest_nav.toFixed(4) : 'N/A'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">As of {scheme.latest_nav_date}</p>
                    </div>
                </div>
            </div>

            {/* Performance KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between transition-colors">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Invested</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-200 font-mono tracking-tight drop-shadow-sm">
                        ₹{kpis.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    {kpis.stamp_duty ? (
                        <p className="text-[11px] text-slate-500 mt-2">Stamp duty: ₹{kpis.stamp_duty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    ) : (
                        <p className="text-[11px] text-slate-500 mt-2">Historic cost basis</p>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between transition-colors">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Current Value</p>
                    <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 dark:from-indigo-400 to-cyan-500 dark:to-cyan-400 font-mono tracking-tight drop-shadow-sm">
                        ₹{kpis.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[11px] text-indigo-500 dark:text-indigo-300 mt-2 font-mono">
                        {kpis.units.toFixed(3)} units active
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between relative overflow-hidden transition-colors">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 relative z-10">Abs. Return</p>
                    <div className="relative z-10">
                        <p className={`text-2xl font-bold font-mono tracking-tight ${isGain ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                            {isGain ? '+' : ''}₹{Math.abs(absGain).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                        <span className={`inline-block px-2 py-0.5 mt-2 rounded font-mono text-xs font-medium ${isGain ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                            {isGain ? '+' : ''}{absPercent.toFixed(2)}%
                        </span>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-md flex flex-col justify-between relative overflow-hidden block">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 relative z-10 drop-shadow-sm">XIRR (Annualized)</p>
                    <div className="relative z-10">
                        {kpis.xirr_status === 'VALID' && kpis.xirr !== undefined ? (
                            <p className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-mono tracking-tight dark:drop-shadow-[0_0_12px_rgba(167,139,250,0.3)]">
                                {kpis.xirr >= 0 ? '+' : ''}{kpis.xirr.toFixed(2)}%
                            </p>
                        ) : kpis.xirr_status === 'LESS_THAN_1_YEAR' ? (
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 inline-block px-3 py-1 rounded">
                                Held &lt; 1 Year
                            </p>
                        ) : (
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400/80">
                                Est. ({kpis.xirr_status})
                            </p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-2 font-mono">Cashflow weighted</p>
                    </div>
                </div>
            </div>

            {/* NAV History Chart */}
            <div className="mb-10">
                <NAVChart
                    data={historyData}
                    isLoading={historyLoading}
                    onRefresh={handleRefreshHistory}
                />
            </div>

            {/* DaaS Advanced Intelligence View */}
            <EnrichmentView amfiCode={amfiCode} />

            {/* Minimalist Ledger Table */}
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200 mb-4 px-1 drop-shadow-sm">Transaction Ledger</h2>
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-tl-xl whitespace-nowrap">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Action</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">NAV</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Units</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-indigo-500 dark:text-indigo-300 uppercase tracking-widest text-right bg-indigo-50 dark:bg-indigo-500/5 rounded-tr-xl whitespace-nowrap border-l border-slate-200 dark:border-white/5">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {ledger.map((row) => {
                                const isOutflow = ['REDEMPTION', 'SWITCH_OUT', 'STP_OUT', 'SWP'].some(t => row.type.toUpperCase().includes(t));

                                return (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 font-medium">
                                            {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className={`w-1.5 h-1.5 rounded-full mr-2 shadow-sm ${isOutflow ? 'bg-rose-500 dark:bg-rose-400' : 'bg-emerald-500 dark:bg-emerald-400'}`}></span>
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide">{row.type.replace(/_/g, ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200 text-right font-mono">
                                            {row.amount === 0 ? '-' : `₹${Math.abs(row.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-500 text-right font-mono tracking-tighter">
                                            ₹{row.nav.toFixed(4)}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono tracking-tighter ${isOutflow ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {isOutflow ? '' : '+'}{row.units.toFixed(3)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-300 font-bold text-right font-mono bg-indigo-50/50 dark:bg-indigo-500/[0.02] border-l border-slate-200 dark:border-white/5 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/[0.05] transition-colors tracking-tighter">
                                            {row.running_balance.toFixed(3)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {ledger.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                                        No transactions recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
