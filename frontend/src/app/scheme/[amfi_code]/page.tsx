"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSchemeDetails, getSchemeHistory } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { NAVChart } from '@/components/charts/NAVChart';

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
            router.push('/upload');
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
            <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Button variant="outline" onClick={() => router.back()} className="mb-6 rounded-full px-6 border-gray-300">
                    &larr; Return to Dashboard
                </Button>
                <div className="bg-white border border-red-100 rounded-2xl p-8 shadow-sm">
                    <p className="text-red-600 font-medium">{error || "No data available."}</p>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <button
                onClick={() => router.back()}
                className="group flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-8 transition-colors"
            >
                <span className="mr-2 transform group-hover:-translate-x-1 transition-transform">&larr;</span>
                Back to Dashboard
            </button>

            {/* Premium Hero Header */}
            <div className="bg-white rounded-3xl p-8 mb-8 border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                {/* Decorative subtle gradient background */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50/40 to-purple-50/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] uppercase font-bold tracking-widest rounded-full">
                                {scheme.fund_house || "Unknown AMC"}
                            </span>
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] uppercase font-bold tracking-widest rounded-full">
                                {scheme.category || "Equity"}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2 text-balance">
                            {scheme.name}
                        </h1>
                        <p className="text-sm font-mono text-gray-400">
                            ISIN: {scheme.isin} <span className="mx-2 opacity-50">•</span> AMFI: {scheme.amfi_code}
                        </p>
                    </div>

                    <div className="text-left md:text-right bg-gray-50/80 backdrop-blur-sm p-4 rounded-2xl border border-gray-100/50">
                        <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">Latest NAV</p>
                        <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
                            ₹{scheme.latest_nav ? scheme.latest_nav.toFixed(4) : 'N/A'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">As of {scheme.latest_nav_date}</p>
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

            {/* Performance KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Invested</p>
                    <p className="text-2xl font-bold text-gray-800 font-mono tracking-tight">
                        ₹{kpis.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    {kpis.stamp_duty ? (
                        <p className="text-[11px] text-gray-400 mt-2">Stamp duty: ₹{kpis.stamp_duty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    ) : (
                        <p className="text-[11px] text-gray-400 mt-2">Historic cost basis</p>
                    )}
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Current Value</p>
                    <p className="text-2xl font-bold text-gray-800 font-mono tracking-tight">
                        ₹{kpis.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-2 font-mono">
                        {kpis.units.toFixed(3)} units active
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 relative z-10">Abs. Return</p>
                    <div className="relative z-10">
                        <p className={`text-2xl font-bold font-mono tracking-tight ${isGain ? 'text-green-600' : 'text-red-500'}`}>
                            {isGain ? '+' : ''}₹{Math.abs(absGain).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                        <p className={`text-[13px] font-bold mt-1 ${isGain ? 'text-green-600/80' : 'text-red-500/80'}`}>
                            {isGain ? '+' : ''}{absPercent.toFixed(2)}%
                        </p>
                    </div>
                    {isGain && <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-green-50 rounded-full blur-2xl pointer-events-none"></div>}
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 relative z-10">XIRR (Annualized)</p>
                    <div className="relative z-10">
                        {kpis.xirr_status === 'VALID' && kpis.xirr !== undefined ? (
                            <p className="text-3xl font-extrabold text-white font-mono tracking-tight">
                                {kpis.xirr >= 0 ? '+' : ''}{kpis.xirr.toFixed(2)}%
                            </p>
                        ) : kpis.xirr_status === 'LESS_THAN_1_YEAR' ? (
                            <p className="text-sm font-medium text-gray-300">
                                Held &lt; 1 Year
                            </p>
                        ) : (
                            <p className="text-sm font-medium text-gray-300">
                                Est. ({kpis.xirr_status})
                            </p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-2">Cashflow weighted</p>
                    </div>
                </div>
            </div>

            {/* Minimalist Ledger Table */}
            <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Transaction Ledger</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">NAV</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Units</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest text-right bg-blue-50/30">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {ledger.map((row) => {
                                const isOutflow = ['REDEMPTION', 'SWITCH_OUT', 'STP_OUT', 'SWP'].some(t => row.type.toUpperCase().includes(t));

                                return (
                                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isOutflow ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                                <span className="text-xs font-semibold text-gray-700 tracking-wide">{row.type.replace(/_/g, ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                                            {row.amount === 0 ? '-' : `₹${Math.abs(row.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-right font-mono">
                                            ₹{row.nav.toFixed(4)}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${isOutflow ? 'text-red-500' : 'text-green-600'}`}>
                                            {isOutflow ? '' : '+'}{row.units.toFixed(3)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right font-mono bg-blue-50/10 border-l border-blue-50/50 group-hover:bg-blue-50/30 transition-colors">
                                            {row.running_balance.toFixed(3)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {ledger.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
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
