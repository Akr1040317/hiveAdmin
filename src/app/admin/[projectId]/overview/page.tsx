'use client';

import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function OverviewPage() {
  const { project } = useProject();
  const accentClasses = project?.accentClasses;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('w-1 h-10 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-3xl font-bold mb-1', accentClasses?.text)}>
              Overview
            </h1>
            <p className="text-gray-400 text-sm">
              Project dashboard and key metrics
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Bugs</p>
                <p className="text-2xl font-bold text-gray-50">—</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-2xl">🐛</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Features</p>
                <p className="text-2xl font-bold text-gray-50">—</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Meetings</p>
                <p className="text-2xl font-bold text-gray-50">—</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Content Items</p>
                <p className="text-2xl font-bold text-gray-50">—</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-background-card/50 border-border-subtle">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['Bugs', 'Features', 'Content', 'Meetings', 'Documents', 'Calendar'].map((item) => (
                <a
                  key={item}
                  href={`/admin/${project?.id}/${item.toLowerCase()}`}
                  className={cn(
                    'block px-4 py-3 rounded-notion transition-all duration-200',
                    'hover:bg-background-hover hover:scale-[1.01]',
                    'border border-border-subtle hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">{item}</span>
                    <span className="text-xs text-gray-500">→</span>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background-card/50 border-border-subtle">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                Activity feed coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
