'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';

function ChangePasswordForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = sp.get('next') || '/projects';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (newPassword !== confirm) {
      setErr('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 8) {
      setErr('New password must be at least 8 characters');
      return;
    }
    setPending(true);
    try {
      const r = await api<{ token: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
        skipAuthRedirect: true,
      });
      setAuthToken(r.token);
      router.replace(next.startsWith('/') ? next : '/projects');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Could not update password');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-in fade-in duration-300 flex min-h-[calc(100vh-6rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            Replace the initial password from your environment with one only you know.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {err && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <Skeleton className="mx-auto h-5 w-24" />
              <Skeleton className="mx-auto mt-2 h-3 w-48" />
            </CardHeader>
            <CardContent className="grid gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  );
}
