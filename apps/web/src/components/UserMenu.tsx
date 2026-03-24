'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { logout } from '@/lib/api';
import { Button } from '@/components/ui/button';

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/bootstrap')) return true;
  return false;
}

export function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  if (isPublicPath(pathname)) {
    return (
      <div className="mt-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="mt-3 text-xs text-muted-foreground">Loading session…</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="break-all text-xs text-muted-foreground">
        {user.email}
      </div>
      <div className="text-xs text-muted-foreground/60">
        {user.role}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto gap-1.5 px-0 text-xs text-muted-foreground hover:text-foreground"
        onClick={async () => {
          await logout();
          router.push('/login');
        }}
      >
        <LogOut size={12} />
        Sign out
      </Button>
    </div>
  );
}
