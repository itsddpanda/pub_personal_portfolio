"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardSummary } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Holding {
    scheme_name: string;
    isin: string;
    invested_value: number;
    current_value: number;
}

export default function TotalGainDrilldownPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [totalGain, setTotalGain] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) {
            router.push('/');
            return;
        }

        const fetchData = async () => {
            try {
                const result = await getDashboardSummary(userId);
                if (!result || !result.holdings) return;

                const activeHoldings = result.holdings.filter((h: any) => h.current_value > 0 || h.invested_value > 0);

                // Sort by absolute gain descending
                activeHoldings.sort((a: Holding, b: Holding) => (b.current_value - b.invested_value) - (a.current_value - a.invested_value));

                setHoldings(activeHoldings);
                setTotalGain(result.total_value - result.invested_value);
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading breakdown...</div>;
    }

    const isPositiveTotal = totalGain >= 0;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-transparent p-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">Total Gain Breakdown</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Calculated as (Current Value - Invested Value) for each scheme.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 w-fit">
                        ← Back to Dashboard
                    </Button>
                </div>

                {/* Summary Card */}
                <Card className={`${isPositiveTotal ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'} shadow-sm dark:shadow-xl backdrop-blur-md`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div>
                            <p className={`text-sm font-semibold uppercase tracking-widest ${isPositiveTotal ? 'text-emerald-700 dark:text-emerald-500' : 'text-rose-700 dark:text-rose-500'}`}>Total Portfolio Gain</p>
                            <p className={`text-4xl font-bold mt-2 font-mono tracking-tight drop-shadow-sm ${isPositiveTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isPositiveTotal ? '+' : ''}₹{totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <p className={`text-sm ${isPositiveTotal ? 'text-emerald-700 dark:text-emerald-400/80' : 'text-rose-700 dark:text-rose-400/80'}`}>Comprised of <strong className={isPositiveTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{holdings.length}</strong> active schemes</p>
                            <p className={`text-xs mt-1 font-mono tracking-tight ${isPositiveTotal ? 'text-emerald-600/70 dark:text-emerald-500/70' : 'text-rose-600/70 dark:text-rose-500/70'}`}>Σ (Current Value - Invested Value)</p>
                        </div>
                    </div>
                </Card>

                {/* Detailed Table */}
                <Card title="Calculation Detail" className="overflow-hidden bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl p-0">
                    <div className="p-6 pb-2 border-b border-slate-200 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Calculation Detail</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-slate-100 dark:divide-white/5">
                            <thead className="bg-slate-50 dark:bg-slate-950/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Scheme</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Current Value</th>
                                    <th className="px-2 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none"></th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Invested Value</th>
                                    <th className="px-2 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none"></th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none bg-slate-100 dark:bg-slate-800/20 border-l border-slate-200 dark:border-white/5">Absolute Gain</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none bg-slate-100 dark:bg-slate-800/20">Gain %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {holdings.map((h) => {
                                    const gain = h.current_value - h.invested_value;
                                    const gainPercent = h.invested_value > 0 ? (gain / h.invested_value) * 100 : 0;
                                    const isPositive = gain >= 0;

                                    return (
                                        <tr key={h.isin} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-300 line-clamp-2 leading-relaxed">{h.scheme_name}</p>
                                                <p className="text-xs text-slate-500 mt-1 font-mono">{h.isin}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-300 text-right font-mono tracking-tight">
                                                ₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-700 text-center font-mono">-</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono tracking-tight">
                                                ₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-700 text-center font-mono">=</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold font-mono tracking-tight bg-slate-50 dark:bg-slate-800/10 border-l border-slate-200 dark:border-white/5 group-hover:bg-slate-100 dark:group-hover:bg-slate-800/30 transition-colors ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {isPositive ? '+' : ''}₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right bg-slate-50 dark:bg-slate-800/10 group-hover:bg-slate-100 dark:group-hover:bg-slate-800/30 transition-colors">
                                                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${isPositive ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'}`}>
                                                    {isPositive ? '+' : ''}{gainPercent.toFixed(2)}%
                                                </span>
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
