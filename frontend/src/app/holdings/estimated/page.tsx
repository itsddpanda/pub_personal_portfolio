"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardSummary } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface EstimatedHolding {
    scheme_name: string;
    isin: string;
    units: number;
    current_nav: number;
    current_value: number;
    invested_value: number;
    is_estimated: boolean;
    opening_balance_units: number;
    opening_balance_date: string;
    purchased_units: number;
    purchased_invested: number;
}

export default function EstimatedHoldingsPage() {
    const [holdings, setHoldings] = useState<EstimatedHolding[]>([]);
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
                const estimated = result.holdings.filter((h: any) => h.is_estimated);
                setHoldings(estimated);
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-transparent p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Estimated Holdings</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            These {holdings.length} scheme{holdings.length !== 1 ? 's have' : ' has'} incomplete transaction history — the invested value shown may be lower than actual.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5">
                        ← Back to Dashboard
                    </Button>
                </div>

                {/* Explanation Banner */}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                        <span className="text-lg">💡</span> Why does this happen?
                    </h3>
                    <p className="text-amber-700/90 dark:text-amber-400/80 text-sm leading-relaxed">
                        When you upload a CAS that covers only a recent period (e.g., last 1 year), schemes you held before
                        that period appear as <strong>&quot;Opening Balance&quot;</strong> entries — they show <em>how many units</em> you held,
                        but <strong>not how much you paid for them</strong>. This makes the invested value appear lower than it actually is.
                    </p>
                    <p className="text-amber-700/90 dark:text-amber-400/80 text-sm mt-3 leading-relaxed">
                        <strong>Fix:</strong> Upload a <strong>Detailed CAS from inception</strong> (covering your entire investment history)
                        from <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 decoration-amber-500/30 hover:decoration-amber-500 font-medium">mycams.com</a>.
                        The system will automatically replace the opening balances with real transaction data.
                    </p>
                </div>

                {/* Per-Scheme Detail Cards */}
                {holdings.map((h) => {
                    const obUnits = h.opening_balance_units || 0;
                    const realUnits = h.purchased_units || 0;
                    const obPct = h.units > 0 ? (obUnits / h.units) * 100 : 0;
                    const missingCost = obUnits * h.current_nav;

                    return (
                        <Card key={h.isin} className="overflow-hidden bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl p-0">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{h.scheme_name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">ISIN: {h.isin}</p>
                                    </div>
                                    <span className="text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl text-lg">⚠️</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Total Units</p>
                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono tracking-tight">{h.units.toFixed(3)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Current Value</p>
                                        <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Invested (Known)</p>
                                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300 font-mono tracking-tight">₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1.5">Missing Cost (Est.)</p>
                                        <p className="text-xl font-bold text-amber-500 dark:text-amber-400 font-mono tracking-tight">~₹{missingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Breakdown Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                        <span>Unit Breakdown (Cost Transparency)</span>
                                        <span className="text-amber-500">{obPct.toFixed(0)}% Opaque</span>
                                    </div>
                                    <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 space-x-0.5 p-0.5">
                                        {realUnits > 0 && (
                                            <div
                                                className="bg-emerald-500 dark:bg-emerald-400 rounded-full"
                                                style={{ width: `${100 - obPct}%` }}
                                                title={`${realUnits.toFixed(1)} units from real purchases`}
                                            />
                                        )}
                                        <div
                                            className="bg-amber-400 dark:bg-amber-500 rounded-full"
                                            style={{ width: `${obPct}%` }}
                                            title={`${obUnits.toFixed(1)} units from opening balance`}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[11px] mt-2 font-medium">
                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            {realUnits > 0 ? `${realUnits.toFixed(1)} units with known cost` : 'No known history'}
                                        </span>
                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                                            {obUnits.toFixed(1)} units from opening balance
                                        </span>
                                    </div>
                                </div>

                                {h.opening_balance_date && (
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-2 text-xs text-slate-400">
                                        <span className="opacity-70">🕒</span>
                                        Opening balance recorded on {new Date(h.opening_balance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}

                {/* CTA */}
                <div className="text-center py-4">
                    <Button onClick={() => router.push('/upload')}>
                        Upload Full-History CAS
                    </Button>
                </div>

            </div>
        </div>
    );
}
