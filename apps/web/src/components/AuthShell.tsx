'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { isPublicPath } from '@/lib/auth-utils';

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();

  if (!isPublicPath(pathname) && loading) {
    return (
      <div className="p-12 text-center text-muted">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
