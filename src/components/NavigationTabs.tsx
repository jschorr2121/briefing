'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Newspaper, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { name: 'Briefing', href: '/', icon: Newspaper },
  { name: 'Hub', href: '/hub', icon: Zap },
];

export function NavigationTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 bg-[var(--card)] rounded-xl p-1 border border-[var(--border)]">
      {tabs.map(tab => {
        const isActive = tab.href === '/' 
          ? pathname === '/' 
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
