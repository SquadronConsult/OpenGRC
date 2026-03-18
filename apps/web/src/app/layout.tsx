'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    section: 'Workspace',
    links: [
      { href: '/projects', label: 'Projects', icon: 'M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z' },
    ],
  },
  {
    section: 'FedRAMP Data',
    links: [
      { href: '/glossary', label: 'Glossary', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' },
      { href: '/requirements', label: 'Requirements', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { href: '/ksi', label: 'KSIs', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <title>OpenGRC</title>
        <meta name="description" content="Open-source FedRAMP compliance platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link href="/" className="sidebar-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              OpenGRC
            </Link>

            {navItems.map((section) => (
              <div key={section.section} className="sidebar-section">
                <div className="sidebar-heading">{section.section}</div>
                {section.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link${pathname.startsWith(item.href) ? ' active' : ''}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="sidebar-footer">
              <div className="text-xs text-dim">OpenGRC v0.1</div>
              <div className="text-xs text-dim" style={{ marginTop: '0.15rem' }}>Local mode</div>
            </div>
          </aside>

          <div className="main-content">
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
