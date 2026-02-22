"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardSummary } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Holding {
    scheme_name: string;
    isin: string;
    units: number;
    current_nav: number;
    current_value: number;
}

export default function CurrentValueDrilldownPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [totalValue, setTotalValue] = useState(0);
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

                // Only show schemes that actually have balance/value
                const activeHoldings = result.holdings.filter((h: any) => h.current_value > 0);

                // Sort by value descending
                activeHoldings.sort((a: Holding, b: Holding) => b.current_value - a.current_value);

                setHoldings(activeHoldings);
                setTotalValue(result.total_value);
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

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-transparent p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">Current Value Breakdown</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Calculated as your active units multiplied by the latest available NAV for each scheme.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 w-fit">
                        ← Back to Dashboard
                    </Button>
                </div>

                {/* Summary Card */}
                <Card className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Portfolio Value</p>
                            <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 dark:from-indigo-400 to-cyan-500 dark:to-cyan-400 mt-1 font-mono tracking-tight drop-shadow-sm">
                                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Comprised of <strong className="text-indigo-600 dark:text-indigo-400">{holdings.length}</strong> active schemes</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">Σ (Units × Latest NAV)</p>
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
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Active Units</th>
                                    <th className="px-2 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none"></th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Latest NAV</th>
                                    <th className="px-2 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none"></th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none bg-indigo-50 dark:bg-indigo-500/5 border-l border-slate-200 dark:border-white/5 rounded-tl-xl ml-2">Current Value</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none bg-indigo-50 dark:bg-indigo-500/5">Weight</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {holdings.map((h) => {
                                    const weight = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0;

                                    return (
                                        <tr key={h.isin} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-300 line-clamp-2 leading-relaxed">{h.scheme_name}</p>
                                                <p className="text-xs text-slate-500 mt-1 font-mono">{h.isin}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono tracking-tight">
                                                {h.units.toFixed(3)}
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-700 text-center font-mono">×</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 text-right font-mono tracking-tight">
                                                ₹{h.current_nav.toFixed(4)}
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-700 text-center font-mono">=</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-300 text-right font-semibold font-mono tracking-tight bg-indigo-50/50 dark:bg-indigo-500/[0.02] border-l border-slate-200 dark:border-white/5 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/[0.05] transition-colors">
                                                ₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right bg-indigo-50/50 dark:bg-indigo-500/[0.02] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/[0.05] transition-colors">
                                                <span className="inline-block px-2.5 py-1 bg-indigo-100 dark:bg-indigo-500/10 rounded-md text-xs text-indigo-700 dark:text-indigo-300 font-mono font-medium border border-indigo-200 dark:border-indigo-500/20">
                                                    {weight.toFixed(1)}%
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
