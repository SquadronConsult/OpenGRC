'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { api } from '@/lib/api';

type SearchHit = {
  type: 'checklist' | 'evidence' | 'risk' | 'policy';
  id: string;
  projectId?: string | null;
  label?: string;
  title?: string;
  filename?: string;
};

function hitLabel(h: SearchHit): string {
  if (h.label) return h.label;
  if (h.title) return h.title;
  if (h.filename) return h.filename;
  return h.id;
}

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      api<{ items: SearchHit[] }>(
        `/search?q=${encodeURIComponent(q)}&limit=30`,
      )
        .then((r) => setItems(r.items ?? []))
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Search failed');
          setItems([]);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  function onSelect(h: SearchHit) {
    setOpen(false);
    const pid = h.projectId ?? undefined;
    if (h.type === 'checklist' && pid) {
      router.push(`/projects/${pid}#item-${h.id}`);
      return;
    }
    if (h.type === 'risk' && pid) {
      router.push(`/projects/${pid}/risk`);
      return;
    }
    if (h.type === 'evidence' && pid) {
      router.push(`/projects/${pid}`);
      return;
    }
    if (h.type === 'policy') {
      router.push('/policies');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 hidden rounded-md border border-border bg-card px-2 py-1 text-[0.65rem] text-muted-foreground shadow-sm md:block"
      >
        Search <kbd className="ml-1 rounded bg-muted px-1 font-mono">⌘K</kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search OpenGRC"
        description="Search controls, evidence, risks, and policies"
      >
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Search (min 2 characters)…"
        />
        <CommandList>
          <CommandEmpty>
            {loading
              ? 'Searching…'
              : q.trim().length < 2
                ? 'Type at least 2 characters'
                : 'No results'}
          </CommandEmpty>
          <CommandGroup heading="Results">
            {items.map((h) => (
              <CommandItem
                key={`${h.type}-${h.id}`}
                value={`${h.type}-${h.id}-${hitLabel(h)}`}
                onSelect={() => onSelect(h)}
              >
                <span className="text-[0.65rem] uppercase text-muted-foreground">
                  {h.type}
                </span>
                <span className="truncate">{hitLabel(h)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
