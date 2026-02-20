"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardSummary, getSyncStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Holding {
    scheme_name: string;
    isin: string;
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
}

import { useToast } from '@/components/ui/Toast';

export default function DashboardPage() {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showEstimatedBanner, setShowEstimatedBanner] = useState(true);
    const router = useRouter();
    const toast = useToast();

    useEffect(() => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) {
            router.push('/');
            return;
        }
        fetchData(userId);

        // Start polling sync status
        const interval = setInterval(async () => {
            try {
                const status = await getSyncStatus();

                // If it just finished syncing, refresh data
                if (syncing && !status.is_syncing && userId) {
                    await fetchData(userId);
                }

                setSyncing(status.is_syncing);
            } catch (e) {
                // Ignore polling errors silently
            }
        }, 5000); // UI poll every 5s

        return () => clearInterval(interval);
    }, [syncing, router]);

    const fetchData = async (userId: string) => {
        try {
            const result = await getDashboardSummary(userId);
            setData(result);
        } catch (error) {
            console.error("Failed to fetch dashboard", error);
            toast.error("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('mfa_user_id');
        router.push('/upload');
    };

    const handleForceSync = async () => {
        const userId = localStorage.getItem('mfa_user_id');
        if (!userId) return;

        try {
            setSyncing(true);
            await fetch('http://localhost:8000/api/sync-nav', {
                method: 'POST',
                headers: { 'x-user-id': userId },
            });
            toast.success("NAV Sync completed successfully.");
            await fetchData(userId);
        } catch (e) {
            toast.error("Failed to sync NAVs.");
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Portfolio...</div>;
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <Card title="Welcome to Portfolio Analyzer" className="max-w-md w-full text-center">
                    <p className="text-gray-600 mb-6">
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

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-800">Portfolio Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        {syncing ? (
                            <div className="flex items-center text-blue-600 text-sm font-medium">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Syncing NAVs...
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm font-medium">
                                {latest_nav_date ? `Latest NAV Date: ${new Date(latest_nav_date).toLocaleDateString()}` : "Latest NAV Date: Pending"}
                            </div>
                        )}
                        <Button variant="outline" onClick={handleForceSync} disabled={syncing}>
                            Force Sync
                        </Button>
                        <Button variant="secondary" onClick={() => router.push('/upload')}>
                            Upload CAS
                        </Button>
                        <Button variant="danger" onClick={handleLogout}>
                            Logout
                        </Button>
                    </div>
                </div>

                {/* Estimated Holdings Warning Banner */}
                {data.has_estimated_holdings && showEstimatedBanner && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                        <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
                        <div className="flex-1">
                            <p className="text-amber-800 text-sm font-medium">
                                {data.estimated_schemes_count} holding{data.estimated_schemes_count > 1 ? 's were' : ' was'} carried forward without full transaction history. Invested Value may be understated.
                            </p>
                            <button onClick={() => router.push('/upload')}
                                className="text-amber-700 underline text-sm mt-1 hover:text-amber-900">
                                Upload a full-history CAS to fix this →
                            </button>
                        </div>
                        <button onClick={() => setShowEstimatedBanner(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0 text-lg">
                            ✕
                        </button>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card title="Current Value">
                        <p className="text-3xl font-bold text-blue-600">₹{total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </Card>
                    <Card title="Invested Value">
                        <p className="text-3xl font-bold text-gray-700">₹{invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        {total_stamp_duty > 0 && (
                            <p className="text-xs text-gray-400 mt-1">Stamp duty: ₹{total_stamp_duty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        )}
                    </Card>
                    <Card title="Total Gain">
                        <p className={`text-3xl font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            <span className="text-sm ml-2 font-normal">({gainPercent.toFixed(2)}%)</span>
                        </p>
                    </Card>
                    <Card title="XIRR">
                        <p className={`text-3xl font-bold ${xirr >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                            {xirr.toFixed(2)}%
                        </p>
                    </Card>
                </div>

                {/* Holdings Table */}
                <Card title="Holdings" className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheme</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">NAV</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Value</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Invested Value</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {holdings.map((h) => (
                                    <tr key={h.isin}>
                                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{h.scheme_name}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{h.units.toFixed(3)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{h.current_nav.toFixed(2)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">₹{h.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                                            <span className="text-gray-700">₹{h.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                            {h.is_estimated && (
                                                <button
                                                    onClick={() => router.push('/holdings/estimated')}
                                                    className="ml-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                                                    title="View details"
                                                >
                                                    ⚠️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {holdings.length === 0 && (
                            <div className="p-4 text-center text-gray-500">No active holdings found.</div>
                        )}
                    </div>
                </Card>

            </div>
        </div>
    );
}
