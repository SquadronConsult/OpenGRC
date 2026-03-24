'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Shield,
  LayoutGrid,
  Settings2,
  BookOpen,
  ClipboardCheck,
  Zap,
  Menu,
  FileText,
  Layers,
} from 'lucide-react';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthShell } from '@/components/AuthShell';
import { UserMenu } from '@/components/UserMenu';
import { MicroGoalBanner } from '@/components/compliance/MicroGoalBanner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { GlobalSearchCommand } from '@/components/GlobalSearchCommand';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navSections: { section: string; links: NavItem[] }[] = [
  {
    section: 'Workspace',
    links: [
      { href: '/projects', label: 'Projects', icon: LayoutGrid },
      { href: '/ops', label: 'Ops', icon: Settings2 },
    ],
  },
  {
    section: 'FedRAMP Data',
    links: [
      { href: '/glossary', label: 'Glossary', icon: BookOpen },
      { href: '/requirements', label: 'Requirements', icon: ClipboardCheck },
      { href: '/ksi', label: 'KSIs', icon: Zap },
    ],
  },
  {
    section: 'GRC',
    links: [
      { href: '/policies', label: 'Policies', icon: FileText },
      { href: '/frameworks/builder', label: 'Framework builder', icon: Layers },
    ],
  },
];

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <Link
        href="/"
        className="flex items-center gap-2.5 px-5 py-4 text-base font-bold tracking-tight text-foreground no-underline"
      >
        <Shield size={20} className="text-primary" aria-hidden="true" />
        OpenGRC
      </Link>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
        {navSections.map((section) => (
          <div key={section.section} className="mb-2">
            <div className="px-2 pb-1 pt-3 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
              {section.section}
            </div>
            {section.links.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-colors',
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <item.icon size={16} aria-hidden="true" className={cn('shrink-0', active ? 'opacity-100' : 'opacity-70')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-border px-4 py-3">
        <div className="text-[0.7rem] text-muted-foreground">OpenGRC v0.2</div>
        <UserMenu />
      </div>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <html lang="en" className="dark">
      <head>
        <title>OpenGRC</title>
        <meta name="description" content="Open-source FedRAMP compliance platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
        >
          Skip to content
        </a>
        <AuthProvider>
          <TooltipProvider>
            <div className="flex min-h-screen">
              {/* Desktop sidebar */}
              <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-border bg-card md:flex">
                <SidebarContent pathname={pathname} />
              </aside>

              {/* Mobile header + sheet */}
              <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center border-b border-border bg-card px-4 md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="mr-2">
                      <Menu size={18} />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-60 p-0">
                    <SidebarContent pathname={pathname} />
                  </SheetContent>
                </Sheet>
                <Link href="/" className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Shield size={16} className="text-primary" aria-hidden="true" />
                  OpenGRC
                </Link>
              </div>

              {/* Main content area */}
              <div className="flex-1 md:ml-60">
                <AuthShell>
                  <MicroGoalBanner className="hidden md:flex" />
                  <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8 mt-12 md:mt-0">
                    {children}
                  </main>
                </AuthShell>
              </div>
            </div>
            <GlobalSearchCommand />
            <Toaster position="bottom-right" richColors />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
