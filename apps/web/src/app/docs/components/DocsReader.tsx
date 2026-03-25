'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Source_Serif_4 } from 'next/font/google';
import { Check, Copy, FileText, List, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPaper, type DocPaperSlug } from '../papers';
import { buildFullPaperMarkdown, buildSectionMarkdown } from '../lib/markdown-build';
import { PaperMarkdown } from './PaperMarkdown';

const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-doc-serif',
});

function parseDoc(raw: string | null): DocPaperSlug {
  return raw === 'controls' ? 'controls' : 'opengrc';
}

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied as Markdown`);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

function CopyMdButton({
  label,
  text,
  className,
}: {
  label: string;
  text: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    await copyText(label, text);
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }, [label, text]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('shrink-0 gap-1.5 text-xs font-medium', className)}
      onClick={onCopy}
    >
      {done ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      {done ? 'Copied' : 'Copy Markdown'}
    </Button>
  );
}

export function DocsReader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = parseDoc(searchParams.get('doc'));
  const paper = useMemo(() => getPaper(slug), [slug]);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = ['intro', ...paper.sections.map((s) => s.id)];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [paper]);

  const setDoc = useCallback(
    (next: DocPaperSlug) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'opengrc') params.delete('doc');
      else params.set('doc', next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [pathname, router, searchParams],
  );

  const fullMd = useMemo(() => buildFullPaperMarkdown(paper), [paper]);

  return (
    <div className={cn('flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-10', serif.variable)}>
      {/* Outline + doc switcher */}
      <aside className="lg:w-56 xl:w-60 lg:shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="space-y-4 rounded-[4px] border border-border/70 bg-card/40 p-4">
          <div className="flex items-center gap-2 text-primary">
            <ScrollText className="size-5" aria-hidden />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em]">Documentation</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="size-3.5" />
              Paper
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setDoc('opengrc')}
                className={cn(
                  'rounded-[4px] px-2.5 py-1.5 text-left text-sm transition-colors',
                  slug === 'opengrc'
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                OpenGRC — product guide
              </button>
              <button
                type="button"
                onClick={() => setDoc('controls')}
                className={cn(
                  'rounded-[4px] px-2.5 py-1.5 text-left text-sm transition-colors',
                  slug === 'controls'
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                Controls program playbook
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              <List className="size-3.5" />
              On this page
            </div>
            <nav className="flex flex-col gap-0.5 text-[0.8rem]">
              <a
                href="#intro"
                className={cn(
                  'rounded-[4px] px-2 py-1.5 transition-colors',
                  activeId === 'intro' ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                Overview
              </a>
              {paper.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    'rounded-[4px] px-2 py-1.5 transition-colors',
                    activeId === s.id ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>

          <p className="text-[0.7rem] leading-snug text-muted-foreground">
            Read linearly like a white paper, or jump via the outline. Use <strong className="text-foreground">Copy Markdown</strong> to paste
            into wikis or repos.
          </p>
        </div>
      </aside>

      {/* Main paper */}
      <article
        className={cn(
          'min-w-0 flex-1 rounded-[4px] border border-border/60 bg-card px-5 py-6 sm:px-6 md:px-8 md:py-8 lg:px-10',
          'font-[family-name:var(--font-doc-serif)]',
        )}
      >
        <header id="intro" className="scroll-mt-28 border-b border-border/50 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/90">White paper</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-[2.15rem]">{paper.title}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">{paper.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CopyMdButton label="Full paper" text={fullMd} />
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
              <Link href="/projects">Open Projects</Link>
            </Button>
            {slug === 'opengrc' ? (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
                <Link href="/mcp">MCP Connect</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
                <Link href="/frameworks/builder">Framework builder</Link>
              </Button>
            )}
          </div>
        </header>

        <div className="mt-8 text-[1.0625rem]">
          <PaperMarkdown markdown={paper.preamble} />
        </div>

        {paper.sections.map((s, index) => {
          const sectionMd = buildSectionMarkdown(s.title, s.body);
          return (
            <section
              key={s.id}
              id={s.id}
              className={cn('scroll-mt-28 border-t border-border/40', index === 0 ? 'mt-12 pt-12' : 'mt-14 pt-14')}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{s.title}</h2>
                <CopyMdButton label="Section" text={sectionMd} />
              </div>
              <div className="mt-4">
                <PaperMarkdown markdown={s.body} />
              </div>
            </section>
          );
        })}
      </article>
    </div>
  );
}
