"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getSchemeEnrichment } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';

interface HoldingHistoryPoint {
    per: string;
    weightage: number;
}

interface Holding {
    stock_name: string;
    sector: string;
    weighting: number;
    market_value: number;
    change_1m: number;
    change_2m?: number;
    change_3m?: number;
    history?: HoldingHistoryPoint[];
    holdings_history?: string;
}

type SortKey = keyof Holding;

export default function HoldingsDrilldownPage() {
    const params = useParams();
    const amfiCode = params.amfi_code as string;
    const router = useRouter();

    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [schemeName, setSchemeName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'weighting', direction: 'desc' });

    useEffect(() => {
        if (!amfiCode) return;

        const fetchData = async () => {
            try {
                const res = await getSchemeEnrichment(amfiCode, false);
                if (res && res.holdings) {
                    // Pre-process holdings history
                    const processed = res.holdings.map((h: any) => {
                        let parsedHistory: HoldingHistoryPoint[] = [];
                        let c2m = undefined;
                        let c3m = undefined;

                        if (h.holdings_history) {
                            try {
                                parsedHistory = JSON.parse(h.holdings_history);
                                // The history is ordered chronologically (oldest to newest)
                                // We reverse it here to make it easier to find "1 month ago, 2 months ago"
                                const rev = [...parsedHistory].reverse();

                                // If the history does NOT include the current weighting at the very end, we should add it
                                // so the sparkline plots the trend up to the current value.
                                if (parsedHistory.length > 0 && h.weighting != null) {
                                  // Quick heuristic: If the last item in history is exactly the same as current weight,
                                  // it might already be included. If not, append it.
                                  if (parsedHistory[parsedHistory.length - 1].weightage !== h.weighting) {
                                      parsedHistory.push({ per: "Current", weightage: h.weighting });
                                  }
                                }

                                // 1M ago is index 0 in `rev`, 2M ago is index 1, 3M ago is index 2.
                                // NOTE: change_1m is already provided by the API accurately, so we use that.
                                if (rev.length > 1 && rev[1].weightage != null && h.weighting != null) {
                                    c2m = h.weighting - rev[1].weightage;
                                }
                                if (rev.length > 2 && rev[2].weightage != null && h.weighting != null) {
                                    c3m = h.weighting - rev[2].weightage;
                                }
                            } catch (e) {
                                console.error("Could not parse history", e);
                            }
                        }

                        return {
                            ...h,
                            change_2m: c2m,
                            change_3m: c3m,
                            history: parsedHistory
                        } as Holding;
                    });

                    setHoldings(processed);
                    setSchemeName(res.scheme_name || `Scheme ${amfiCode}`);
                }
            } catch (err: any) {
                console.error("Failed to fetch holdings", err);
                setError(err.message || 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [amfiCode]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 ml-1 inline" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500 ml-1 inline" /> : <ArrowDown className="w-3 h-3 text-indigo-500 ml-1 inline" />;
    };

    const sortedAndFilteredHoldings = React.useMemo(() => {
        let filtered = holdings.filter(h => h.stock_name?.toLowerCase().includes(searchTerm.toLowerCase()) || h.sector?.toLowerCase().includes(searchTerm.toLowerCase()));

        filtered.sort((a, b) => {
            const valA = a[sortConfig.key] ?? (typeof a[sortConfig.key] === 'string' ? '' : -Infinity);
            const valB = b[sortConfig.key] ?? (typeof b[sortConfig.key] === 'string' ? '' : -Infinity);

            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return filtered;
    }, [holdings, sortConfig, searchTerm]);

    // Helper to draw a tiny sparkline
    const renderSparkline = (history: HoldingHistoryPoint[] | undefined) => {
        if (!history || history.length < 2) return <span className="text-slate-300 dark:text-slate-600">-</span>;

        // Take up to 3 most recent months (for a 3M trendline)
        const pts = history.slice(-3);
        const weights = pts.map(p => p.weightage);
        const minW = Math.min(...weights);
        const maxW = Math.max(...weights);

        // Scale to a 60x20 SVG box
        const w = 60;
        const h = 20;
        const pad = 2; // padding so stroke isn't clipped

        // If it's a completely flat line (e.g. 0 min and 0 max, or completely unchanged)
        if (maxW === minW) {
            return (
                <svg width={w} height={h} className="inline-block overflow-visible">
                    <title>{`Flat at ${minW.toFixed(2)}%`}</title>
                    <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="currentColor" strokeWidth="1.5" className="text-slate-400" />
                </svg>
            );
        }

        const range = maxW - minW || 1;

        // Coordinates for points
        const coords = pts.map((p, i) => {
            const cx = (i / (pts.length - 1)) * w;
            const cy = h - pad - ((p.weightage - minW) / range) * (h - pad * 2);
            return `${cx},${cy}`;
        }).join(' ');

        // Determine color based on overall start to end trend
        const start = pts[0].weightage;
        const end = pts[pts.length - 1].weightage;
        const colorClass = end > start ? "text-emerald-500" : end < start ? "text-rose-500" : "text-slate-400";

        const tooltipStr = pts.map(p => `${p.per}: ${p.weightage.toFixed(2)}%`).join(' → ');

        return (
            <svg width={w} height={h} className="inline-block overflow-visible">
                <title>{tooltipStr}</title>
                <polyline
                    points={coords}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={colorClass}
                />
            </svg>
        );
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading holdings data...</div>;
    }

    if (error) {
        return (
            <div className="p-8 text-center text-rose-500">
                <p className="mb-4">{error}</p>
                <Button onClick={() => router.back()} variant="outline">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-transparent p-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">Portfolio Holdings</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Complete instrument breakdown for {schemeName}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push(`/scheme/${amfiCode}`)} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 w-fit">
                        &larr; Back to Scheme Details
                    </Button>
                </div>

                {/* Data Table Card */}
                <Card title="All Holdings" className="overflow-hidden bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl p-0 flex flex-col h-[calc(100vh-14rem)]">
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">All Holdings <span className="text-sm font-medium text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-2">{holdings.length}</span></h3>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search stock or sector..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            />
                        </div>
                    </div>

                    <div className="overflow-auto flex-1 relative">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none group" onClick={() => handleSort('stock_name')}>
                                        Instrument Name {getSortIcon('stock_name')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none group" onClick={() => handleSort('sector')}>
                                        Sector {getSortIcon('sector')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none text-right group" onClick={() => handleSort('weighting')}>
                                        Weight % {getSortIcon('weighting')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none text-right group hidden lg:table-cell" onClick={() => handleSort('market_value')}>
                                        Market Value (₹ Cr) {getSortIcon('market_value')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none text-right group border-l border-slate-200 dark:border-white/5" onClick={() => handleSort('change_1m')}>
                                        1M Change {getSortIcon('change_1m')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none text-right group hidden sm:table-cell" onClick={() => handleSort('change_2m')}>
                                        2M Change {getSortIcon('change_2m')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none text-right group hidden sm:table-cell" onClick={() => handleSort('change_3m')}>
                                        3M Change {getSortIcon('change_3m')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 select-none text-center bg-transparent border-l border-slate-200 dark:border-white/5 hidden md:table-cell">
                                        3M Trend
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {sortedAndFilteredHoldings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 italic">No holdings match your search.</td>
                                    </tr>
                                ) : sortedAndFilteredHoldings.map((h, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-2 text-slate-800 dark:text-slate-300 font-medium whitespace-normal max-w-[200px] md:max-w-xs">{h.stock_name}</td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400 hidden xl:table-cell">{h.sector || '-'}</td>
                                        <td className="px-4 py-2 text-right font-mono font-medium text-slate-900 dark:text-slate-300">
                                            {h.weighting != null ? `${h.weighting.toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                                            {h.market_value != null ? h.market_value.toLocaleString('en-IN') : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono border-l border-slate-100 dark:border-white/5">
                                            {h.change_1m != null ? (
                                                <span className={h.change_1m > 0 ? "text-emerald-500" : h.change_1m < 0 ? "text-rose-500" : "text-slate-500"}>
                                                    {h.change_1m > 0 ? '+' : ''}{h.change_1m.toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono hidden sm:table-cell">
                                            {h.change_2m != null ? (
                                                <span className={h.change_2m > 0 ? "text-emerald-500" : h.change_2m < 0 ? "text-rose-500" : "text-slate-500"}>
                                                    {h.change_2m > 0 ? '+' : ''}{h.change_2m.toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono hidden sm:table-cell">
                                            {h.change_3m != null ? (
                                                <span className={h.change_3m > 0 ? "text-emerald-500" : h.change_3m < 0 ? "text-rose-500" : "text-slate-500"}>
                                                    {h.change_3m > 0 ? '+' : ''}{h.change_3m.toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-center border-l border-slate-100 dark:border-white/5 hidden md:table-cell">
                                            {renderSparkline(h.history)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
