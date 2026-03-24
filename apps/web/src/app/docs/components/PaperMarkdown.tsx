'use client';

import { useCallback, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function PreWithCopy({ children, className, ...props }: ComponentProps<'pre'>) {
  const ref = useRef<HTMLPreElement>(null);
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    const text = ref.current?.innerText ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Code copied');
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  }, []);

  return (
    <div className="group relative my-5">
      <pre ref={ref} className={cn('overflow-x-auto rounded-lg border border-border/80 bg-[#070b10] p-4 pr-14 text-[0.85rem] leading-relaxed text-[#e2e8f0]', className)} {...props}>
        {children}
      </pre>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        onClick={copy}
        aria-label="Copy code block"
      >
        {done ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

const paperComponents: Components = {
  a: ({ href, children, className, ...rest }) => {
    if (href?.startsWith('/')) {
      return (
        <Link href={href} className={cn('font-medium text-primary underline-offset-4 hover:underline', className)} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={cn('font-medium text-primary underline-offset-4 hover:underline', className)}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
      >
        {children}
      </a>
    );
  },
  h1: ({ className, ...props }) => (
    <h1 className={cn('scroll-mt-28 text-3xl font-bold tracking-tight text-foreground', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        'scroll-mt-28 mt-14 border-b border-border/80 pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('scroll-mt-28 mt-8 text-lg font-semibold text-foreground', className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn('scroll-mt-28 mt-6 text-base font-semibold text-foreground', className)} {...props} />
  ),
  p: ({ className, ...props }) => <p className={cn('my-4 leading-[1.75] text-[#d8d4cc]', className)} {...props} />,
  ul: ({ className, ...props }) => <ul className={cn('my-4 list-disc pl-6 text-[#d8d4cc]', className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn('my-4 list-decimal pl-6 text-[#d8d4cc]', className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn('my-1.5 pl-1', className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn('my-6 border-l-4 border-primary/40 bg-primary/[0.04] py-1 pl-4 pr-2 text-[#c9c4b8] italic', className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn('my-10 border-border/60', className)} {...props} />,
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border/80">
      <table className={cn('w-full min-w-[20rem] border-collapse text-sm', className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn('bg-muted/40', className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn('border-b border-border px-3 py-2 text-left font-semibold text-foreground', className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn('border-b border-border/70 px-3 py-2 text-[#d8d4cc]', className)} {...props} />
  ),
  strong: ({ className, ...props }) => <strong className={cn('font-semibold text-foreground', className)} {...props} />,
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      return (
        <code className={cn('font-mono text-[0.9em] text-emerald-200/95', className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn('rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[0.88em] text-foreground', className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, className, ...props }) => (
    <PreWithCopy className={className} {...props}>
      {children}
    </PreWithCopy>
  ),
};

type PaperMarkdownProps = {
  markdown: string;
  className?: string;
};

export function PaperMarkdown({ markdown, className }: PaperMarkdownProps) {
  return (
    <div className={cn('paper-markdown', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={paperComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
