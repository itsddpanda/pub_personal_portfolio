"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSchemeEnrichment } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';

interface Peer {
    fund_name: string;
    peer_isin: string;
    cagr_1y?: number;
    cagr_3y?: number;
    cagr_5y?: number;
    cagr_10y?: number;
    expense_ratio?: number;
    std_deviation?: number;
    portfolio_turnover?: number;
    yield_to_maturity?: number;
    modified_duration?: number;
    avg_eff_maturity?: number;
}

type SortKey = keyof Peer;

export default function PeersDrilldownPage() {
    const params = useParams();
    const amfiCode = params.amfi_code as string;
    const router = useRouter();

    const [peers, setPeers] = useState<Peer[]>([]);
    const [schemeName, setSchemeName] = useState<string>('');
    const [schemeIsin, setSchemeIsin] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'cagr_1y', direction: 'desc' });

    useEffect(() => {
        if (!amfiCode) return;

        const fetchData = async () => {
            try {
                const res = await getSchemeEnrichment(amfiCode, false);
                if (res && res.peers) {
                    setPeers(res.peers);
                    setSchemeName(res.scheme_name || `Scheme ${amfiCode}`);
                    setSchemeIsin(res.isin || '');
                }
            } catch (err: any) {
                console.error("Failed to fetch peers", err);
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

    const sortedAndFilteredPeers = React.useMemo(() => {
        let filtered = peers.filter(p => p.fund_name?.toLowerCase().includes(searchTerm.toLowerCase()));

        filtered.sort((a, b) => {
            const valA = a[sortConfig.key] ?? -Infinity;
            const valB = b[sortConfig.key] ?? -Infinity;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [peers, sortConfig, searchTerm]);

    const hasDebt = peers.some(p => p.yield_to_maturity != null || p.modified_duration != null);
    const hasTurnover = peers.some(p => p.portfolio_turnover != null);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading peers data...</div>;
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
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">Category Peers Comparison</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Extended performance and risk metrics for {schemeName}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push(`/scheme/${amfiCode}`)} className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 w-fit shrink-0">
                        &larr; Back to Scheme Details
                    </Button>
                </div>

                {/* Data Table Card */}
                <Card title="All Category Peers" className="overflow-hidden bg-white/90 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl p-0 flex flex-col h-[calc(100vh-14rem)]">
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Extended Data Table <span className="text-sm font-medium text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-2">{peers.length}</span></h3>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by fund name..."
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
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none bg-inherit" onClick={() => handleSort('fund_name')}>
                                        Fund Name {getSortIcon('fund_name')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit border-l border-slate-200 dark:border-white/5" onClick={() => handleSort('cagr_1y')}>
                                        1Y Ret {getSortIcon('cagr_1y')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('cagr_3y')}>
                                        3Y Ret {getSortIcon('cagr_3y')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('cagr_5y')}>
                                        5Y Ret {getSortIcon('cagr_5y')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('cagr_10y')}>
                                        10Y Ret {getSortIcon('cagr_10y')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit border-l border-slate-200 dark:border-white/5" onClick={() => handleSort('expense_ratio')}>
                                        Exp Ratio {getSortIcon('expense_ratio')}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('std_deviation')}>
                                        Volatility {getSortIcon('std_deviation')}
                                    </th>
                                    {hasTurnover && (
                                        <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('portfolio_turnover')}>
                                            Turnover {getSortIcon('portfolio_turnover')}
                                        </th>
                                    )}
                                    {hasDebt && (
                                        <>
                                            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit border-l border-slate-200 dark:border-white/5" onClick={() => handleSort('yield_to_maturity')}>
                                                YTM {getSortIcon('yield_to_maturity')}
                                            </th>
                                            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('modified_duration')}>
                                                Duration {getSortIcon('modified_duration')}
                                            </th>
                                            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none text-right bg-inherit" onClick={() => handleSort('avg_eff_maturity')}>
                                                Avg Maturity {getSortIcon('avg_eff_maturity')}
                                            </th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {sortedAndFilteredPeers.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-8 text-center text-slate-500 italic">No peers match your search.</td>
                                    </tr>
                                ) : sortedAndFilteredPeers.map((p, i) => {
                                    const isHighlight = (p.peer_isin === schemeIsin) || (p.fund_name === schemeName);
                                    return (
                                        <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${isHighlight ? 'bg-indigo-100/50 dark:bg-indigo-500/20 shadow-[inset_4px_0_0_0_theme(colors.indigo.500)]' : ''}`}>
                                            <td className={`px-4 py-2 font-medium ${isHighlight ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-300'}`}>
                                                <div className="flex items-center gap-2">
                                                    {p.fund_name}
                                                    {isHighlight && (
                                                        <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500 text-white rounded uppercase tracking-tighter">Current</span>
                                                    )}
                                                </div>
                                                {p.fund_name === 'Unknown Peer' && p.peer_isin && <div className="text-[10px] text-slate-400 font-mono">ISIN: {p.peer_isin}</div>}
                                            </td>

                                            <td className="px-4 py-2 text-right font-mono border-l border-slate-100 dark:border-white/5">
                                                {p.cagr_1y != null ? <span className={p.cagr_1y > 0 ? "text-emerald-500" : p.cagr_1y < 0 ? "text-rose-500" : "text-slate-600"}>{p.cagr_1y.toFixed(2)}%</span> : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {p.cagr_3y != null ? <span className={p.cagr_3y > 0 ? "text-emerald-500" : p.cagr_3y < 0 ? "text-rose-500" : "text-slate-600"}>{p.cagr_3y.toFixed(2)}%</span> : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {p.cagr_5y != null ? <span className={p.cagr_5y > 0 ? "text-emerald-500" : p.cagr_5y < 0 ? "text-rose-500" : "text-slate-600"}>{p.cagr_5y.toFixed(2)}%</span> : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {p.cagr_10y != null ? <span className={p.cagr_10y > 0 ? "text-emerald-500" : p.cagr_10y < 0 ? "text-rose-500" : "text-slate-600"}>{p.cagr_10y.toFixed(2)}%</span> : '-'}
                                            </td>

                                            <td className="px-4 py-2 text-right font-mono text-slate-900 dark:text-slate-300 border-l border-slate-100 dark:border-white/5">
                                                {p.expense_ratio != null ? `${p.expense_ratio.toFixed(2)}%` : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                {p.std_deviation != null ? `${p.std_deviation.toFixed(2)}%` : '-'}
                                            </td>
                                            {hasTurnover && (
                                                <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                    {p.portfolio_turnover != null ? `${p.portfolio_turnover.toFixed(2)}%` : '-'}
                                                </td>
                                            )}

                                            {hasDebt && (
                                                <>
                                                    <td className="px-4 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 border-l border-slate-100 dark:border-white/5">
                                                        {p.yield_to_maturity != null ? `${p.yield_to_maturity.toFixed(2)}%` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                        {p.modified_duration != null ? `${p.modified_duration.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                        {p.avg_eff_maturity != null ? `${p.avg_eff_maturity.toFixed(2)}` : '-'}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
