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
    fetch(`http://localhost:8000/api/users`)
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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Mutual Fund Analyzer &nbsp;
          <code className="font-mono font-bold">v1.0</code>
        </p>
      </div>

      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-to-tr before:from-blue-400 before:to-purple-500 before:opacity-10 before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-to-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px]">
        <h1 className="text-5xl font-bold text-gray-900 mb-8 z-10">
          Privacy-First Portfolio Analytics
        </h1>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-2 lg:text-left gap-8">
        <Card title="Upload CAS">
          <p className="mb-4 text-gray-500">
            Parse your CAMS/KFintech CAS PDF locally. No data leaves your device.
          </p>
          <Link href="/upload">
            <Button>Upload New CAS</Button>
          </Link>
        </Card>

        {showDashboard ? (
          <Card title="Return to Dashboard">
            <p className="mb-4 text-gray-500">
              Welcome back! Your portfolio session is active.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                Go to Dashboard &rarr;
              </Button>
            </Link>
          </Card>
        ) : usersExist ? (
          <Card title="Select User">
            <p className="mb-4 text-gray-500">
              Profiles found on this device. Use the "Login" menu in the top right to access your portfolio.
            </p>
            <p className="mt-2 text-sm text-blue-600 font-medium animate-pulse">
              &uarr; Click Login at the top right
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
