'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { api, setAuthToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BootstrapPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Administrator');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setPending(true);
    try {
      const r = await api<{ token: string }>('/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name: name || undefined,
          bootstrapToken,
        }),
        skipAuthRedirect: true,
      });
      setAuthToken(r.token);
      router.replace('/projects');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Bootstrap failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-in fade-in duration-300 flex min-h-[calc(100vh-6rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">First admin</CardTitle>
          <CardDescription>
            Runs once when no users exist. Requires{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              BOOTSTRAP_TOKEN
            </code>{' '}
            on the API server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="btoken">Bootstrap token</Label>
              <Input
                id="btoken"
                type="password"
                autoComplete="off"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Admin email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8 chars)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {err && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating…' : 'Create admin & sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
