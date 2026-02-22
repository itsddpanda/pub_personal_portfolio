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
            <div className="w-full h-80 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-white/5 animate-pulse shadow-sm">
                <p className="text-slate-500 font-medium">Loading History...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-80 flex flex-col items-center justify-center bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-white/5 p-6 text-center shadow-sm">
                <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">No historical data available.</p>
                <p className="text-xs text-slate-500 mb-4">Historical backfill may take a few minutes if this is a new scheme.</p>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow hover:shadow-md dark:hover:shadow-lg text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-mono"
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
                <div className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-xl dark:shadow-2xl">
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-1 font-mono tracking-tight">{date}</p>
                    <p className="text-slate-900 dark:text-slate-100 font-bold tracking-tight text-lg font-mono">
                        ₹{payload[0].value.toFixed(4)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const ranges: TimeRange[] = ['1Y', '3Y', '5Y', 'MAX'];

    return (
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">NAV History</h3>
                    <p className="text-xs text-slate-500 mt-1">Performance tracked over time</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
                        {ranges.map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-4 py-1.5 text-xs font-bold tracking-wider rounded-lg transition-all ${range === r
                                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm dark:shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                                    : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="p-2.5 text-slate-500 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all shadow-sm"
                            title="Force Refresh Background Sync"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21v-5h5" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="w-full h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={filteredData}
                        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" strokeOpacity={0.5} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatXAxis}
                            minTickGap={60}
                            tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'monospace' }} /* Slate 500 is fine for both */
                            axisLine={false}
                            tickLine={false}
                            dy={15}
                        />
                        <YAxis
                            domain={yDomain}
                            tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'monospace' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `₹${value}`}
                            dx={-10}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <ReferenceLine y={filteredData[0]?.nav} stroke="#64748b" strokeDasharray="3 3" opacity={0.5} />
                        <Line
                            type="stepAfter"
                            dataKey="nav"
                            stroke="#818cf8"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5, fill: "#818cf8", strokeWidth: 2 }}
                            animationDuration={600}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
