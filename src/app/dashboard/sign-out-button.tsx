'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { signOutAction } from './actions';

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">
        <LogOut className="mr-2 h-4 w-4" />
        ログアウト
      </Button>
    </form>
  );
}
