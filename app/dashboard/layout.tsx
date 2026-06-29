import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { checkQuota } from '@/lib/usage';
import { SignOutButton } from './SignOutButton';

const NAV = [
  { href: '/dashboard/sources', label: 'Sources' },
  { href: '/dashboard/keys', label: 'API Keys' },
  { href: '/dashboard/webhooks', label: 'Webhooks' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const quota = await checkQuota(user.id).catch(() => null);
  const pct = quota ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gray-950 flex" style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800">
          <Link href="/dashboard/sources" className="text-white font-bold text-sm">Sift</Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/"
            className="block px-3 py-2 rounded text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            Playground ↗
          </Link>
          <Link
            href="/docs"
            className="block px-3 py-2 rounded text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            API Docs ↗
          </Link>
        </nav>

        {/* Usage widget */}
        {quota && (
          <div className="px-4 py-3 border-t border-gray-800 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Extractions</span>
              <span>{quota.used} / {quota.limit}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-700">
              Resets {new Date(quota.resetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}

        {/* User + sign out */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 truncate">{user.email}</span>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
