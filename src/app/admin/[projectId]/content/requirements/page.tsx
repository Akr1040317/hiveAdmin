'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useServerAction } from '@/hooks/useServerAction';
import {
  getContentRequirements,
  getComplianceStatus,
  getUpcomingRequirements,
  confirmRequirement,
  markRequirementMissed,
  checkRequirementCompliance,
  ContentRequirement,
  ContentRequirementType,
} from '@/app/actions/content-requirements';
import { useAuth } from '@/contexts/AuthContext';
import { RequirementStatus, RequirementStatusList } from '@/components/content/RequirementStatus';
import { RequirementTracker } from '@/components/content/RequirementTracker';
import {
  getContentTypeLabel,
  getPeriodLabel,
  getRequirementStatusColor,
} from '@/lib/content-requirements';
import { format, startOfWeek, addDays, addWeeks, isSameDay, isWithinInterval } from 'date-fns';
import { CheckCircle2, XCircle, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';

const CONTENT_TYPES: ContentRequirementType[] = ['video', 'article', 'tips_tricks', 'word_of_the_day'];

export default function RequirementsDashboardPage() {
  const { project, projectId } = useProject();
  const { user } = useAuth();
  const accentClasses = project?.accentClasses;

  const [requirements, setRequirements] = useState<ContentRequirement[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<any[]>([]);
  const [upcomingRequirements, setUpcomingRequirements] = useState<ContentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContentType, setSelectedContentType] = useState<ContentRequirementType | 'all'>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [checkingCompliance, setCheckingCompliance] = useState(false);

  const { execute: loadRequirements } = useServerAction(getContentRequirements);
  const { execute: loadCompliance } = useServerAction(getComplianceStatus);
  const { execute: loadUpcoming } = useServerAction(getUpcomingRequirements);
  const { execute: confirmReq } = useServerAction(confirmRequirement);
  const { execute: markMissed } = useServerAction(markRequirementMissed);
  const { execute: checkCompliance } = useServerAction(checkRequirementCompliance);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId, selectedContentType, dateRange]);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      const startDate = new Date();
      const endDate = new Date();

      if (dateRange === 'week') {
        endDate.setDate(endDate.getDate() + 7);
      } else if (dateRange === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 3);
      }

      const filters: any = {
        startDate,
        endDate,
      };
      if (selectedContentType !== 'all') {
        filters.contentType = selectedContentType;
      }

      const [reqs, compliance, upcoming] = await Promise.all([
        loadRequirements(projectId, filters),
        loadCompliance(projectId, startDate, endDate),
        loadUpcoming(projectId, 14),
      ]);

      if (reqs) setRequirements(reqs);
      if (compliance) setComplianceStatus(compliance);
      if (upcoming) setUpcomingRequirements(upcoming);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRequirement = async (requirementId: string) => {
    if (!projectId || !user?.email) return;
    await confirmReq(projectId, requirementId, undefined, user.email);
    await loadData();
  };

  const handleMarkMissed = async (requirementId: string) => {
    if (!projectId) return;
    await markMissed(projectId, requirementId);
    await loadData();
  };

  const handleCheckCompliance = async () => {
    if (!projectId) return;
    setCheckingCompliance(true);
    try {
      await checkCompliance(projectId);
      await loadData();
    } finally {
      setCheckingCompliance(false);
    }
  };

  const filteredRequirements = useMemo(() => {
    return requirements.sort((a, b) => {
      const dateA = new Date(a.periodStart).getTime();
      const dateB = new Date(b.periodStart).getTime();
      return dateA - dateB;
    });
  }, [requirements]);

  const requirementsByStatus = useMemo(() => {
    const byStatus: Record<string, ContentRequirement[]> = {
      met: [],
      pending: [],
      missed: [],
    };
    filteredRequirements.forEach((req) => {
      byStatus[req.status].push(req);
    });
    return byStatus;
  }, [filteredRequirements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading requirements...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
            <div>
              <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Content Requirements</h1>
              <p className="text-sm text-gray-400">Track publishing compliance and requirements</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCheckCompliance}
              disabled={checkingCompliance}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className={cn('w-4 h-4 mr-1.5', checkingCompliance && 'animate-spin')} />
              {checkingCompliance ? 'Checking...' : 'Check Compliance'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Content Type:</label>
            <Select
              value={selectedContentType}
              onChange={(e) => setSelectedContentType(e.target.value as ContentRequirementType | 'all')}
              className="w-40"
            >
              <option value="all">All Types</option>
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getContentTypeLabel(type)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Date Range:</label>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter')}
              className="w-32"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Compliance Overview Cards */}
          {complianceStatus.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {complianceStatus.map((status) => (
                <Card
                  key={status.contentType}
                  className="bg-background-card/50 border-border-subtle"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-300">
                        {getContentTypeLabel(status.contentType)}
                      </h3>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            status.complianceRate >= 80
                              ? '#22c55e'
                              : status.complianceRate >= 50
                              ? '#eab308'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Compliance</span>
                        <span className="font-semibold text-gray-200">{status.complianceRate}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Met</span>
                        <span className="text-green-400">{status.met}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Pending</span>
                        <span className="text-yellow-400">{status.pending}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Missed</span>
                        <span className="text-red-400">{status.missed}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Upcoming Requirements */}
          {upcomingRequirements.length > 0 && (
            <Card className="bg-background-card/50 border-border-subtle">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Upcoming Requirements (Next 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <RequirementStatusList
                  requirements={upcomingRequirements.slice(0, 10)}
                  onRequirementClick={(req) => {
                    // Could open a modal or navigate to detail view
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Visual Trackers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Trackers */}
            {['video', 'article', 'tips_tricks'].map((type) => {
              const typeReqs = requirements.filter((r) => r.contentType === type && r.periodType === 'weekly');
              if (typeReqs.length === 0 && selectedContentType !== 'all' && selectedContentType !== type) {
                return null;
              }
              return (
                <Card key={type} className="bg-background-card/50 border-border-subtle">
                  <CardContent className="p-6">
                    <RequirementTracker
                      requirements={requirements}
                      contentType={type as ContentRequirementType}
                      onConfirm={handleConfirmRequirement}
                      onMarkMissed={handleMarkMissed}
                      startDate={dateRange === 'week' ? new Date() : undefined}
                      endDate={
                        dateRange === 'week'
                          ? (() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 7);
                              return d;
                            })()
                          : dateRange === 'month'
                          ? (() => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 1);
                              return d;
                            })()
                          : (() => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 3);
                              return d;
                            })()
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}

            {/* Daily Tracker (WOTD) */}
            {(!selectedContentType || selectedContentType === 'all' || selectedContentType === 'word_of_the_day') && (
              <Card className="bg-background-card/50 border-border-subtle lg:col-span-2">
                <CardContent className="p-6">
                  <RequirementTracker
                    requirements={requirements}
                    contentType="word_of_the_day"
                    onConfirm={handleConfirmRequirement}
                    onMarkMissed={handleMarkMissed}
                    startDate={dateRange === 'week' ? new Date() : undefined}
                    endDate={
                      dateRange === 'week'
                        ? (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 7);
                            return d;
                          })()
                        : dateRange === 'month'
                        ? (() => {
                            const d = new Date();
                            d.setMonth(d.getMonth() + 1);
                            return d;
                          })()
                        : (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 30);
                            return d;
                          })()
                    }
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Requirements by Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Met Requirements */}
            <Card className="bg-background-card/50 border-border-subtle">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Met ({requirementsByStatus.met.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <RequirementStatusList
                  requirements={requirementsByStatus.met.slice(0, 10)}
                  onRequirementClick={(req) => {
                    // Could open detail view
                  }}
                />
              </CardContent>
            </Card>

            {/* Pending Requirements */}
            <Card className="bg-background-card/50 border-border-subtle">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-yellow-400" />
                    Pending ({requirementsByStatus.pending.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {requirementsByStatus.pending.slice(0, 10).map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border-subtle hover:border-border transition-colors"
                    >
                      <RequirementStatus requirement={req} showLabel={true} />
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleConfirmRequirement(req.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          onClick={() => handleMarkMissed(req.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Missed
                        </Button>
                      </div>
                    </div>
                  ))}
                  {requirementsByStatus.pending.length === 0 && (
                    <div className="text-sm text-gray-400 py-4 text-center">
                      No pending requirements
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Missed Requirements */}
            <Card className="bg-background-card/50 border-border-subtle">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    Missed ({requirementsByStatus.missed.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <RequirementStatusList
                  requirements={requirementsByStatus.missed.slice(0, 10)}
                  onRequirementClick={(req) => {
                    // Could open detail view
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
