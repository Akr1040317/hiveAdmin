'use client';

import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function OverviewPage() {
  const { project } = useProject();
  const accentClasses = project?.accentClasses;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className={cn('text-3xl font-bold mb-2', accentClasses?.text)}>
          Overview
        </h1>
        <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
        <p className="text-gray-400 mt-4">
          Project dashboard and key metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className={cn('text-6xl mb-4', accentClasses?.text)}>📊</div>
            <p className="text-gray-400">
              TODO: Phase 3 - Implement overview dashboard with key metrics, recent activity, and quick actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
