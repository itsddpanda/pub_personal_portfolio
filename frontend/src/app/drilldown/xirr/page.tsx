"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDashboardSummary } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Holding {
    scheme_name: string;
    isin: string;
    amfi_code?: string;
    invested_value: number;
    current_value: number;
    xirr?: number;
    xirr_status?: string;
    is_redeemed?: boolean;
}

export default function XirrDrilldownPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [portfolioXirr, setPortfolioXirr] = useState(0);
    const [loading, setLoading] = useState(true);
    const [redeemedCount, setRedeemedCount] = useState(0);
    const [showRedeemed, setShowRedeemed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mfa_show_redeemed') === 'true';
        }
        return false;
    });
    const router = useRouter();

    const toggleRedeemed = () => {
        const next = !showRedeemed;
        setShowRedeemed(next);
        localStorage.setItem('mfa_show_redeemed', String(next));
    };

    useEffect(() => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) {
            router.push('/');
            return;
        }

        const fetchData = async () => {
            try {
                const result = await getDashboardSummary(userId, showRedeemed);
                if (!result || !result.holdings) return;

                let activeHoldings = result.holdings;
                setRedeemedCount(result.redeemed_count || 0);

                // Sort by XIRR descending, bringing errors/NA to bottom
                activeHoldings.sort((a: Holding, b: Holding) => {
                    if (a.xirr !== undefined && b.xirr !== undefined) return b.xirr - a.xirr;
                    if (a.xirr !== undefined) return -1;
                    if (b.xirr !== undefined) return 1;
                    return 0;
                });

                setHoldings(activeHoldings);
                setPortfolioXirr(result.xirr);
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router, showRedeemed]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading breakdown...</div>;
    }

    const isPositiveXirr = portfolioXirr >= 0;

    return (
        <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">XIRR (Extended Internal Rate of Return)</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Time-weighted annualized return of your entire portfolio.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleRedeemed}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${showRedeemed
                                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 shadow-sm'
                                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-200 dark:hover:border-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                            title={showRedeemed ? 'Hide fully exited holdings' : 'Show fully exited holdings'}
                        >
                            <span className="text-xs">👁</span>
                            Show Exited
                            {redeemedCount > 0 && (
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${showRedeemed
                                        ? 'bg-indigo-200/60 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                    {redeemedCount}
                                </span>
                            )}
                        </button>
                        <Button variant="outline" onClick={() => router.push('/dashboard')} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 w-fit">
                            ← Back to Dashboard
                        </Button>
                    </div>
                </div>

                {/* Summary Card */}
                <Card className={`${isPositiveXirr ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'} shadow-sm dark:shadow-xl backdrop-blur-md`}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between">
                        <div>
                            <p className={`text-sm font-semibold uppercase tracking-widest ${isPositiveXirr ? 'text-violet-700 dark:text-violet-500' : 'text-rose-700 dark:text-rose-500'}`}>Portfolio Aggregate XIRR</p>
                            <p className={`text-5xl font-extrabold mt-3 font-mono tracking-tighter drop-shadow-md ${isPositiveXirr ? 'text-violet-600 dark:text-violet-400 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isPositiveXirr ? '+' : ''}{portfolioXirr.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 p-5 rounded-2xl mb-6 text-sm flex gap-4 backdrop-blur-md shadow-sm">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                        <p className="font-bold mb-1.5 text-indigo-900 dark:text-indigo-200">How XIRR Works</p>
                        <p className="leading-relaxed text-indigo-800/90 dark:text-indigo-300/80">
                            XIRR applies a strict time-weighted formula to every exact transaction date (SIPs, lumpsums, redemptions) to calculate your annualized return. Per-scheme XIRR is fully supported for investments held longer than 1 year with a clear entry and exit history.
                        </p>
                    </div>
                </div>

                {/* Detailed Table */}
                <Card title="Per-Scheme XIRR Breakdown" className="overflow-hidden bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl p-0">
                    <div className="p-6 pb-4 border-b border-slate-200 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Per-Scheme XIRR Breakdown</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Individual XIRR calculated based on exact historical cashflows.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-slate-100 dark:divide-white/5">
                            <thead className="bg-slate-50 dark:bg-slate-950/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Scheme</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Invested Value</th>
                                    <th className="px-2 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none"></th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest leading-none bg-violet-50 dark:bg-violet-500/5 border-l border-slate-200 dark:border-white/5">Per-Scheme XIRR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {holdings.map((h) => {
                                    const gain = h.current_value - h.invested_value;
                                    const gainPercent = h.invested_value > 0 ? (gain / h.invested_value) * 100 : 0;
                                    const isPositive = gain >= 0;

                                    return (
                                        <tr key={h.isin} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${h.is_redeemed ? 'opacity-55' : ''}`}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Link href={h.amfi_code ? `/scheme/${h.amfi_code}` : '#'} className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-slate-800 dark:text-slate-300 block">
                                                        <p className="text-sm font-medium line-clamp-2 leading-relaxed">{h.scheme_name}</p>
                                                    </Link>
                                                    {h.is_redeemed && (
                                                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-white/10">
                                                            Exited
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 font-mono">{h.isin}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono tracking-tight">
                                                ₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-700 text-center font-mono">→</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right bg-violet-50/50 dark:bg-violet-500/[0.02] border-l border-slate-200 dark:border-white/5 group-hover:bg-violet-100 dark:group-hover:bg-violet-500/[0.05] transition-colors">
                                                {h.xirr_status === 'VALID' && h.xirr !== undefined ? (
                                                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold font-mono tracking-tight border shadow-sm ${h.xirr >= 0 ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'}`}>
                                                        {h.xirr >= 0 ? '+' : ''}{h.xirr.toFixed(2)}%
                                                    </span>
                                                ) : h.xirr_status === 'ESTIMATED' ? (
                                                    <span className="inline-block px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-md text-[11px] font-bold uppercase tracking-wider" title="Cannot calculate XIRR without full transaction history.">
                                                        N/A - Estimated
                                                    </span>
                                                ) : h.xirr_status === 'LESS_THAN_1_YEAR' ? (
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5 rounded-md text-[11px] font-bold uppercase tracking-wider shadow-inner" title="XIRR mathematically unreliable for <1 year.">
                                                            N/A - &lt;1 Year
                                                        </span>
                                                        <span className={`text-[11px] font-mono tracking-normal font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                            {isPositive ? '+' : ''}{gainPercent.toFixed(2)}% (Abs)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-600 text-[11px] font-bold uppercase tracking-wider">Error</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {holdings.length === 0 && (
                            <div className="p-12 text-center text-slate-500">No active holdings found.</div>
                        )}
                    </div>
                </Card>

            </div>
        </div>
    );
}
