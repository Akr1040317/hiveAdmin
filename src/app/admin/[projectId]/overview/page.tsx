'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useServerAction } from '@/hooks/useServerAction';
import { getBugs } from '@/app/actions/bugs';
import { getFeatures } from '@/app/actions/features';
import { getTasks } from '@/app/actions/tasks';
import { getMeetings } from '@/app/actions/meetings';
import { getCalendarItems } from '@/app/actions/calendar';
import { Bug, Star, CheckSquare, Users, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  iconBg: string;
  href?: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, gradientFrom, gradientTo, borderColor, iconBg, href, subtitle }: StatCardProps) {
  const gradientClasses: Record<string, string> = {
    'blue-cyan': 'from-blue-500/10 to-cyan-500/10 border-blue-500/20 hover:border-blue-500/40',
    'purple-pink': 'from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40',
    'orange-red': 'from-orange-500/10 to-red-500/10 border-orange-500/20 hover:border-orange-500/40',
    'pink-rose': 'from-pink-500/10 to-rose-500/10 border-pink-500/20 hover:border-pink-500/40',
    'green-emerald': 'from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40',
  };
  
  const gradientKey = `${gradientFrom}-${gradientTo}`;
  const gradientClass = gradientClasses[gradientKey] || gradientClasses['blue-cyan'];

  const content = (
    <Card className={cn(
      'bg-gradient-to-br border transition-all duration-200 hover:scale-[1.02]',
      gradientClass,
      href && 'cursor-pointer'
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-50 mb-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', iconBg)}>
            <div className="text-gray-200">
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default function OverviewPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;

  const [bugs, setBugs] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [calendarItems, setCalendarItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { execute: loadBugs } = useServerAction(getBugs);
  const { execute: loadFeatures } = useServerAction(getFeatures);
  const { execute: loadTasks } = useServerAction(getTasks);
  const { execute: loadMeetings } = useServerAction(getMeetings);
  const { execute: loadCalendarItems } = useServerAction(getCalendarItems);

  useEffect(() => {
    if (projectId) {
      Promise.all([
        loadBugs(projectId).then(data => data && setBugs(data)),
        loadFeatures(projectId).then(data => data && setFeatures(data)),
        loadTasks(projectId).then(data => data && setTasks(data)),
        loadMeetings(projectId).then(data => data && setMeetings(data)),
        loadCalendarItems(projectId).then(data => data && setCalendarItems(data)),
      ]).finally(() => setLoading(false));
    }
  }, [projectId]);

  // Calculate stats
  const stats = {
    bugs: {
      total: bugs.length,
      inProgress: bugs.filter(b => b.status === 'in_progress').length,
      critical: bugs.filter(b => b.severity === 'critical').length,
    },
    features: {
      total: features.length,
      inDevelopment: features.filter(f => f.status === 'in_development').length,
      released: features.filter(f => f.status === 'released').length,
    },
    tasks: {
      total: tasks.length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    },
    meetings: {
      total: meetings.length,
      upcoming: meetings.filter(m => new Date(m.startsAt) > new Date()).length,
    },
    calendar: {
      total: calendarItems.length,
      upcoming: calendarItems.filter(c => new Date(c.date) >= new Date()).length,
    },
  };

  // Get recent items
  const recentBugs = [...bugs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const recentFeatures = [...features].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const upcomingMeetings = [...meetings]
    .filter(m => new Date(m.startsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 5);

  const quickActions = [
    { name: 'Bugs', href: `/admin/${projectId}/bugs`, icon: Bug, iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    { name: 'Features', href: `/admin/${projectId}/features`, icon: Star, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10' },
    { name: 'Tasks', href: `/admin/${projectId}/tasks`, icon: CheckSquare, iconColor: 'text-orange-400', iconBg: 'bg-orange-500/10' },
    { name: 'Meetings', href: `/admin/${projectId}/meetings`, icon: Users, iconColor: 'text-pink-400', iconBg: 'bg-pink-500/10' },
    { name: 'Calendar', href: `/admin/${projectId}/calendar`, icon: Calendar, iconColor: 'text-green-400', iconBg: 'bg-green-500/10' },
    { name: 'Content', href: `/admin/${projectId}/content`, icon: FileText, iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/10' },
    { name: 'Documents', href: `/admin/${projectId}/documents`, icon: FileText, iconColor: 'text-cyan-400', iconBg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Overview</h1>
            <p className="text-sm text-gray-400">Project dashboard and key metrics</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading overview...</div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Bugs"
                value={stats.bugs.total}
                icon={<Bug className="w-6 h-6" />}
                gradientFrom="blue"
                gradientTo="cyan"
                borderColor="blue"
                iconBg="bg-blue-500/20"
                href={`/admin/${projectId}/bugs`}
                subtitle={stats.bugs.inProgress > 0 ? `${stats.bugs.inProgress} in progress` : undefined}
              />
              <StatCard
                title="Features"
                value={stats.features.total}
                icon={<Star className="w-6 h-6" />}
                gradientFrom="purple"
                gradientTo="pink"
                borderColor="purple"
                iconBg="bg-purple-500/20"
                href={`/admin/${projectId}/features`}
                subtitle={stats.features.inDevelopment > 0 ? `${stats.features.inDevelopment} in development` : undefined}
              />
              <StatCard
                title="Tasks"
                value={stats.tasks.total}
                icon={<CheckSquare className="w-6 h-6" />}
                gradientFrom="orange"
                gradientTo="red"
                borderColor="orange"
                iconBg="bg-orange-500/20"
                href={`/admin/${projectId}/tasks`}
                subtitle={stats.tasks.completed > 0 ? `${stats.tasks.completed} completed` : undefined}
              />
              <StatCard
                title="Meetings"
                value={stats.meetings.total}
                icon={<Users className="w-6 h-6" />}
                gradientFrom="pink"
                gradientTo="rose"
                borderColor="pink"
                iconBg="bg-pink-500/20"
                href={`/admin/${projectId}/meetings`}
                subtitle={stats.meetings.upcoming > 0 ? `${stats.meetings.upcoming} upcoming` : undefined}
              />
              <StatCard
                title="Calendar"
                value={stats.calendar.total}
                icon={<Calendar className="w-6 h-6" />}
                gradientFrom="green"
                gradientTo="emerald"
                borderColor="green"
                iconBg="bg-green-500/20"
                href={`/admin/${projectId}/calendar`}
                subtitle={stats.calendar.upcoming > 0 ? `${stats.calendar.upcoming} upcoming` : undefined}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          key={action.name}
                          href={action.href}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                            'hover:bg-background-hover hover:scale-[1.01]',
                            'border border-border-subtle hover:border-border',
                            'group'
                          )}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                            action.iconBg,
                            'group-hover:opacity-80'
                          )}>
                            <Icon className={cn('w-4 h-4', action.iconColor)} />
                          </div>
                          <span className="text-sm font-medium text-gray-200 flex-1">{action.name}</span>
                          <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Bugs */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Bugs</CardTitle>
                    <Link href={`/admin/${projectId}/bugs`} className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
                      View all →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentBugs.length > 0 ? (
                    <div className="space-y-3">
                      {recentBugs.map((bug) => (
                        <Link
                          key={bug.id}
                          href={`/admin/${projectId}/bugs`}
                          className="block p-3 rounded-lg border border-border-subtle hover:border-border hover:bg-background-hover transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-200 truncate group-hover:text-gray-100">
                                {bug.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(bug.updatedAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              bug.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              bug.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              bug.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            )}>
                              {bug.severity}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No bugs yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Meetings */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Upcoming Meetings</CardTitle>
                    <Link href={`/admin/${projectId}/meetings`} className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
                      View all →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcomingMeetings.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingMeetings.map((meeting) => (
                        <Link
                          key={meeting.id}
                          href={`/admin/${projectId}/meetings`}
                          className="block p-3 rounded-lg border border-border-subtle hover:border-border hover:bg-background-hover transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-200 truncate group-hover:text-gray-100">
                                {meeting.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(meeting.startsAt), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <div className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium capitalize',
                              meeting.meetingType === 'internal' ? 'bg-blue-500/20 text-blue-400' :
                              meeting.meetingType === 'partner' ? 'bg-purple-500/20 text-purple-400' :
                              meeting.meetingType === 'ops' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-green-500/20 text-green-400'
                            )}>
                              {meeting.meetingType}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No upcoming meetings</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Bugs by Status */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Bugs by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['reported', 'in_progress', 'blocked', 'fixed', 'verified'].map((status) => {
                      const count = bugs.filter(b => b.status === status).length;
                      const percentage = stats.bugs.total > 0 ? Math.round((count / stats.bugs.total) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-background-hover rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-300 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Features by Status */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Features by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['idea', 'planned', 'in_development', 'released'].map((status) => {
                      const count = features.filter(f => f.status === status).length;
                      const percentage = stats.features.total > 0 ? Math.round((count / stats.features.total) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-background-hover rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-300 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tasks by Status */}
              <Card className="bg-background-card/50 border-border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Tasks by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['todo', 'in_progress', 'blocked', 'completed'].map((status) => {
                      const count = tasks.filter(t => t.status === status).length;
                      const percentage = stats.tasks.total > 0 ? Math.round((count / stats.tasks.total) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-background-hover rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-300 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
