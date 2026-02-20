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
            router.push('/upload');
            return;
        }

        const fetchData = async () => {
            try {
                const result = await getDashboardSummary(userId);
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Estimated Holdings</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            These {holdings.length} scheme{holdings.length !== 1 ? 's have' : ' has'} incomplete transaction history — the invested value shown may be lower than actual.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        ← Back to Dashboard
                    </Button>
                </div>

                {/* Explanation Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="text-amber-800 font-semibold text-sm mb-2">Why does this happen?</h3>
                    <p className="text-amber-700 text-sm leading-relaxed">
                        When you upload a CAS that covers only a recent period (e.g., last 1 year), schemes you held before
                        that period appear as <strong>"Opening Balance"</strong> entries — they show <em>how many units</em> you held,
                        but <strong>not how much you paid for them</strong>. This makes the invested value appear lower than it actually is.
                    </p>
                    <p className="text-amber-700 text-sm mt-2 leading-relaxed">
                        <strong>Fix:</strong> Upload a <strong>Detailed CAS from inception</strong> (covering your entire investment history)
                        from <a href="https://www.camsonline.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">mycams.com</a> or
                        {' '}<a href="https://www.kfintech.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">kfintech.com</a>.
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
                        <Card key={h.isin} className="overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">{h.scheme_name}</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">ISIN: {h.isin}</p>
                                    </div>
                                    <span className="text-amber-500 text-lg">⚠️</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Units</p>
                                        <p className="text-lg font-semibold text-gray-800">{h.units.toFixed(3)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Current Value</p>
                                        <p className="text-lg font-semibold text-blue-600">₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Invested (Known)</p>
                                        <p className="text-lg font-semibold text-gray-700">₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Missing Cost (Est.)</p>
                                        <p className="text-lg font-semibold text-amber-600">~₹{missingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Breakdown Bar */}
                                <div className="mb-3">
                                    <div className="flex items-center text-xs text-gray-500 mb-1">
                                        <span>Unit Breakdown</span>
                                    </div>
                                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                                        {realUnits > 0 && (
                                            <div
                                                className="bg-green-400"
                                                style={{ width: `${100 - obPct}%` }}
                                                title={`${realUnits.toFixed(1)} units from real purchases`}
                                            />
                                        )}
                                        <div
                                            className="bg-amber-400"
                                            style={{ width: `${obPct}%` }}
                                            title={`${obUnits.toFixed(1)} units from opening balance`}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                        <span className="text-green-600">
                                            {realUnits > 0 ? `${realUnits.toFixed(1)} units with known cost` : ''}
                                        </span>
                                        <span className="text-amber-600">
                                            {obUnits.toFixed(1)} units from opening balance ({obPct.toFixed(0)}%)
                                        </span>
                                    </div>
                                </div>

                                {h.opening_balance_date && (
                                    <p className="text-xs text-gray-400">
                                        Opening balance recorded on {new Date(h.opening_balance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
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
