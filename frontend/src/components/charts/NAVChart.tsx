"use client";

import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

interface NAVDataPoint {
    date: string;
    nav: number;
}

interface NAVChartProps {
    data: NAVDataPoint[];
    isLoading?: boolean;
    onRefresh?: () => void;
}

type TimeRange = '1Y' | '3Y' | '5Y' | 'MAX';

export function NAVChart({ data, isLoading, onRefresh }: NAVChartProps) {
    const [range, setRange] = useState<TimeRange>('MAX');

    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Data is assumed to be sorted oldest to newest from backend
        if (range === 'MAX') return data;

        const latestDateStr = data[data.length - 1].date;
        const latestDate = new Date(latestDateStr);

        let cutoffDate = new Date(latestDate);
        if (range === '1Y') cutoffDate.setFullYear(latestDate.getFullYear() - 1);
        if (range === '3Y') cutoffDate.setFullYear(latestDate.getFullYear() - 3);
        if (range === '5Y') cutoffDate.setFullYear(latestDate.getFullYear() - 5);

        return data.filter(d => new Date(d.date) >= cutoffDate);
    }, [data, range]);

    if (isLoading) {
        return (
            <div className="w-full h-80 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 animate-pulse">
                <p className="text-gray-400 font-medium">Loading History...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-80 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-gray-500 font-medium mb-2">No historical data available.</p>
                <p className="text-xs text-gray-400 mb-4">Historical backfill may take a few minutes if this is a new scheme.</p>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-sm font-medium rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Refresh Data
                    </button>
                )}
            </div>
        );
    }

    // Calculate high/low for the current view
    const navs = filteredData.map(d => d.nav);
    const minNav = Math.min(...navs);
    const maxNav = Math.max(...navs);

    // Custom Y-axis domain with slight padding
    const yDomain = [
        Math.floor(minNav * 0.95),
        Math.ceil(maxNav * 1.05)
    ];

    const formatXAxis = (tickItem: string) => {
        const d = new Date(tickItem);
        return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(-2)}`;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const date = new Date(label).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            return (
                <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg shadow-xl">
                    <p className="text-gray-300 text-xs mb-1 font-mono">{date}</p>
                    <p className="text-white font-bold tracking-tight">
                        ₹{payload[0].value.toFixed(4)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const ranges: TimeRange[] = ['1Y', '3Y', '5Y', 'MAX'];

    return (
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">NAV History</h3>
                    <p className="text-xs text-gray-500">Historical performance over time</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100/80 p-1 rounded-full border border-gray-200/50">
                        {ranges.map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1 text-[11px] font-bold tracking-wider rounded-full transition-all ${range === r
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="Force Refresh Background Sync"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21v-5h5" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={filteredData}
                        margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatXAxis}
                            minTickGap={50}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            domain={yDomain}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `₹${value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={filteredData[0]?.nav} stroke="#cbd5e1" strokeDasharray="3 3" />
                        <Line
                            type="monotone"
                            dataKey="nav"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: "#1e40af", strokeWidth: 0 }}
                            animationDuration={500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
