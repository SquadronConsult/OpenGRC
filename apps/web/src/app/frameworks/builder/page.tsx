'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Placeholder for custom framework builder (catalog mapping UI). */
export default function FrameworkBuilderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Framework builder</h1>
        <p className="text-sm text-muted-foreground">
          Visual authoring for internal controls and catalog cross-maps will build on the
          generic catalog APIs. Use{' '}
          <Link className="text-primary underline" href="/requirements">
            Requirements
          </Link>{' '}
          and project scoping for now.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Backend endpoints: <code className="text-xs">GET /catalog/cross-map</code>, internal
            control coverage queries, and OSCAL import/export on projects.
          </p>
          <Button type="button" variant="outline" asChild>
            <Link href="/projects">Go to projects</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
