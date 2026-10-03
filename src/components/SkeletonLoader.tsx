import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-2xl", className)} />
  );
}

export function SkeletonCardGrid({ count = 6 }: SkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
          </div>
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-4/5" />
          <div className="pt-2 flex justify-between items-center">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ count = 5 }: SkeletonProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
      <SkeletonBlock className="h-10 w-full rounded-2xl" />
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonBlock key={idx} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  );
}
