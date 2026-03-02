"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [usersExist, setUsersExist] = useState(false);

  useEffect(() => {
    // Check if user is logged in locally
    const userId = localStorage.getItem("mfa_user_id");

    // Always fetch users to see if we have profiles created
    fetch(`/api/users`)
      .then(res => res.json())
      .then((users: any[]) => {
        if (users && users.length > 0) {
          setUsersExist(true);
          if (userId && users.find(u => u.id === userId)) {
            setShowDashboard(true);
          } else {
            // Cleanup stale id if it doesn't exist in DB anymore
            if (userId) localStorage.removeItem("mfa_user_id");
          }
        }
      })
      .catch(() => { /* API down? Ignore, show default */ });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[128px] -z-10 pointer-events-none" />

      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-16">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/50 pb-6 pt-8 backdrop-blur-xl lg:static lg:w-auto lg:rounded-2xl lg:border lg:bg-slate-100/50 dark:lg:bg-slate-800/50 lg:p-4 text-slate-800 dark:text-slate-300 shadow-sm dark:shadow-none">
          Mutual Fund Analyzer &nbsp;
          <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">v0.9.78</code>
        </p>
      </div>

      <div className="relative flex place-items-center mb-16">
        <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-slate-500 mb-8 z-10 text-center tracking-tight">
          Privacy-First<br />Portfolio Analytics
        </h1>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-2 lg:text-left gap-8">
        <Card title="Upload CAS">
          <p className="mb-6 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto lg:mx-0">
            Parse your CAMS/KFintech CAS PDF locally. No data leaves your device.
          </p>
          <Link href="/upload">
            <Button className="w-full lg:w-auto">Upload New CAS</Button>
          </Link>
        </Card>

        {showDashboard ? (
          <Card title="Return to Dashboard">
            <p className="mb-6 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto lg:mx-0">
              Welcome back! Your portfolio session is active.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full lg:w-auto">
                Go to Dashboard &rarr;
              </Button>
            </Link>
          </Card>
        ) : usersExist ? (
          <Card title="Select User">
            <p className="mb-4 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto lg:mx-0">
              Profiles found on this device. Use the &quot;Login&quot; menu in the top right to access your portfolio.
            </p>
            <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
              &uarr; Click Login at the top right
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
