'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/bootstrap')) return true;
  return false;
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();

  if (!isPublicPath(pathname) && loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }} className="text-muted">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
