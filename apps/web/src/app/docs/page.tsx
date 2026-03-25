'use client';

import { Suspense } from 'react';
import { DocsReader } from './components/DocsReader';

function DocsFallback() {
  return (
    <div className="flex animate-pulse flex-col gap-6 py-4">
      <div className="h-10 w-2/3 max-w-md rounded-[4px] bg-muted" />
      <div className="h-4 w-full max-w-2xl rounded-[4px] bg-muted" />
      <div className="h-4 w-5/6 max-w-xl rounded-[4px] bg-muted" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[14rem_1fr]">
        <div className="h-64 rounded-[4px] bg-muted/60" />
        <div className="h-96 rounded-[4px] bg-muted/40" />
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<DocsFallback />}>
      <DocsReader />
    </Suspense>
  );
}
