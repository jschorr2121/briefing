'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { HubFeed } from '@/components/hub/HubFeed';

export default function HubPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen pb-20">
        <Header />
        <HubFeed />
      </main>
    </AuthGuard>
  );
}
