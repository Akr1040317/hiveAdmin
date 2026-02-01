'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { BoardView } from '@/components/shared/BoardView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { Bug, getBugs, createBug, updateBug, deleteBug, FeedbackReport, getFeedbackReports, convertReportToBug, unconvertBugToReport, isBugConvertedFromReport, generateBugEmail, sendBugUpdateEmail } from '@/app/actions/bugs';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';

function BugsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [convertingReportId, setConvertingReportId] = useState<string | null>(null);
  const [convertedReportId, setConvertedReportId] = useState<string | null>(null);

  const { execute: loadBugs, loading } = useServerAction(getBugs);
  const { execute: handleCreateBug } = useServerAction(createBug);
  const { execute: handleUpdateBug } = useServerAction(updateBug);
  const { execute: handleDeleteBug } = useServerAction(deleteBug);
  const { execute: loadFeedbackReports, loading: loadingReports } = useServerAction(getFeedbackReports);
  const { execute: convertReportToBugAction } = useServerAction(convertReportToBug);
  const { execute: unconvertBugAction } = useServerAction(unconvertBugToReport);
  const { execute: checkIfConverted } = useServerAction(isBugConvertedFromReport);
  const { execute: handleGenerateEmail } = useServerAction(generateBugEmail);
  const { execute: handleSendEmail } = useServerAction(sendBugUpdateEmail);

  useEffect(() => {
    if (projectId) {
      loadBugs(projectId).then((data) => {
        if (data) setBugs(data);
      });
      
      // Load feedback reports for prepcenter projects
      if (project?.firebaseProjectType === 'prepcenter') {
        loadFeedbackReports(projectId).then((data) => {
          if (data) setFeedbackReports(data);
        });
      }
    }
  }, [projectId, project]);

  // No default filter needed - show all bugs

  // Apply filters and search to bugs only (reports are shown separately in board)
  const filteredBugs = useMemo(() => {
    let result = bugs;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(bug =>
        bug.title.toLowerCase().includes(searchLower) ||
        bug.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(bug => (bug as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(bug => (bug as any)[filter.field] !== filter.value);
      } else if (filter.operator === 'contains') {
        const val = String((bug as any)[filter.field] || '').toLowerCase();
        result = result.filter(bug => val.includes(String(filter.value).toLowerCase()));
      }
    });

    return result;
  }, [bugs, search, filters]);

  const handleCreate = async (data: Partial<Bug>) => {
    if (!projectId) return;
    const newBug: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: data.title || 'Untitled Bug',
      description: data.description || '',
      platform: data.platform || 'web',
      severity: data.severity || 'medium',
      status: data.status || 'reported',
      tags: data.tags || [],
      order: bugs.length,
    };
    await handleCreateBug(projectId, newBug);
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<Bug>) => {
    if (!projectId || !selectedBug) return;
    await handleUpdateBug(projectId, selectedBug.id, updates);
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
    setSelectedBug({ ...selectedBug, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedBug) return;
    if (confirm('Are you sure you want to delete this bug?')) {
      await handleDeleteBug(projectId, selectedBug.id);
      const updated = await loadBugs(projectId);
      if (updated) setBugs(updated);
      setIsDrawerOpen(false);
      setSelectedBug(null);
    }
  };

  const handleCardMove = async (bugId: string, newStatus: Bug['status']) => {
    if (!projectId) {
      console.warn('No projectId, cannot move card');
      return;
    }
    
    const bug = bugs.find(b => b.id === bugId);
    if (!bug) {
      console.error('Bug not found:', bugId);
      return;
    }
    
    // Don't update if status hasn't changed
    if (bug.status === newStatus) {
      console.log('Status unchanged, skipping update');
      return;
    }
    
    console.log('Moving bug:', bugId, 'from', bug.status, 'to', newStatus);
    
    // Optimistically update the UI immediately
    const previousBugs = [...bugs];
    setBugs(prevBugs => 
      prevBugs.map(b => 
        b.id === bugId ? { ...b, status: newStatus } : b
      )
    );
    
    try {
      const result = await handleUpdateBug(projectId, bugId, { status: newStatus });
      console.log('Bug status updated successfully:', result);
      
      // Reload to ensure consistency with server
      const updated = await loadBugs(projectId);
      if (updated) {
        setBugs(updated);
        console.log('Bugs reloaded from server');
      } else {
        // If reload failed, keep optimistic update
        console.warn('Failed to reload bugs, keeping optimistic update');
      }
    } catch (error) {
      console.error('Failed to update bug status:', error);
      // Revert optimistic update on error
      setBugs(previousBugs);
      
      // Try to reload to get current state
      try {
        const updated = await loadBugs(projectId);
        if (updated) setBugs(updated);
      } catch (reloadError) {
        console.error('Failed to reload bugs:', reloadError);
      }
      
      // Show user-friendly error
      alert(`Failed to move bug: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConvertReport = async (reportId: string) => {
    if (!projectId) return;
    
    setConvertingReportId(reportId);
    try {
      await convertReportToBugAction(projectId, reportId);
      // Reload both bugs and reports
      const [updatedBugs, updatedReports] = await Promise.all([
        loadBugs(projectId),
        loadFeedbackReports(projectId),
      ]);
      if (updatedBugs) setBugs(updatedBugs);
      if (updatedReports) setFeedbackReports(updatedReports);
    } catch (error) {
      console.error('Failed to convert report:', error);
      alert('Failed to convert report to bug. Please try again.');
    } finally {
      setConvertingReportId(null);
    }
  };

  // Check if selected bug was converted from a report
  useEffect(() => {
    if (selectedBug && projectId) {
      checkIfConverted(projectId, selectedBug.id).then((reportId) => {
        setConvertedReportId(reportId);
      }).catch((error) => {
        console.error('Error checking if bug was converted:', error);
        setConvertedReportId(null);
      });
    } else {
      setConvertedReportId(null);
    }
  }, [selectedBug, projectId, checkIfConverted]);

  const handleUnconvertBug = async (bugId: string) => {
    if (!projectId) return;
    
    if (!confirm('Are you sure you want to unconvert this bug back to a report? The bug will be deleted and the report will appear in Pending Reports again.')) {
      return;
    }
    
    try {
      await unconvertBugAction(projectId, bugId);
      // Reload both bugs and reports
      const [updatedBugs, updatedReports] = await Promise.all([
        loadBugs(projectId),
        loadFeedbackReports(projectId),
      ]);
      if (updatedBugs) setBugs(updatedBugs);
      if (updatedReports) setFeedbackReports(updatedReports);
      setIsDrawerOpen(false);
      setSelectedBug(null);
      setConvertedReportId(null);
    } catch (error) {
      console.error('Failed to unconvert bug:', error);
      alert(`Failed to unconvert bug: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = async () => {
    if (!projectId) return;
    const [updatedBugs, updatedReports] = await Promise.all([
      loadBugs(projectId),
      project?.firebaseProjectType === 'prepcenter' ? loadFeedbackReports(projectId) : Promise.resolve(null),
    ]);
    if (updatedBugs) setBugs(updatedBugs);
    if (updatedReports) setFeedbackReports(updatedReports);
  };

  // Get reporter email for a bug
  const getReporterEmail = (bug: Bug | null): string | null => {
    if (!bug) return null;
    // Check if bug has email in createdBy
    if (bug.createdBy && bug.createdBy.includes('@')) {
      return bug.createdBy;
    }
    // If converted from report, try to find email from report
    if (bug.convertedFromReportId) {
      const report = feedbackReports.find(r => r.id === bug.convertedFromReportId);
      if (report?.email) {
        return report.email;
      }
    }
    return null;
  };

  // Format bug details for copying
  const formatBugDetailsForCopy = (bug: Bug | null): string => {
    if (!bug) return '';
    
    const statusLabels: Record<string, string> = {
      reported: 'New',
      in_progress: 'In Progress',
      blocked: 'In Review',
      fixed: 'Completed',
      verified: 'Verified',
    };

    const formatDateTime = (date: Date | string | undefined) => {
      if (!date) return 'Not set';
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'MMM d, yyyy h:mm a');
    };

    const formatDate = (date: Date | string | undefined) => {
      if (!date) return 'Not set';
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'MMM d, yyyy');
    };

    return `
ISSUE DETAILS
═══════════════════════════════════════════════════════════

ID: ${bug.id}
Status: ${statusLabels[bug.status] || bug.status}
Subject: ${bug.title || 'No Subject'}

REPORTER INFORMATION
───────────────────────────────────────────────────────────
Email: ${bug.createdBy || 'Not provided'}
Reported: ${formatDateTime(bug.createdAt)}

CLASSIFICATION
───────────────────────────────────────────────────────────
Platform: ${bug.platform || 'Not specified'}
Severity: ${bug.severity || 'Not specified'}

DESCRIPTION
───────────────────────────────────────────────────────────
${bug.description || 'No description provided'}

${bug.stepsToReproduce ? `STEPS TO REPRODUCE
───────────────────────────────────────────────────────────
${bug.stepsToReproduce}

` : ''}${bug.expectedBehavior ? `EXPECTED BEHAVIOR
───────────────────────────────────────────────────────────
${bug.expectedBehavior}

` : ''}${bug.actualBehavior ? `ACTUAL BEHAVIOR
───────────────────────────────────────────────────────────
${bug.actualBehavior}

` : ''}DATES
───────────────────────────────────────────────────────────
Due Date: ${bug.dueDate ? formatDate(bug.dueDate) : 'Not set'}
Completion Date: ${bug.completionDate ? formatDate(bug.completionDate) : 'Not set'}

${bug.notes ? `NOTES
───────────────────────────────────────────────────────────
${bug.notes}

` : ''}═══════════════════════════════════════════════════════════
    `.trim();
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'severity', label: 'Severity', type: 'select' as const },
    { value: 'platform', label: 'Platform', type: 'select' as const },
    { value: 'updatedAt', label: 'Updated', type: 'date' as const },
    { value: 'createdBy', label: 'Created By', type: 'text' as const },
  ];

  const statusOptions = [
    { value: 'reported', label: 'Reported' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'verified', label: 'Verified' },
  ];

  const severityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const platformOptions = [
    { value: 'ios', label: 'iOS' },
    { value: 'web', label: 'Web' },
    { value: 'admin', label: 'Admin' },
    { value: 'backend', label: 'Backend' },
  ];

  const tableColumns: TableColumn<Bug>[] = [
    {
      key: 'status',
      header: 'STATUS',
      sortable: true,
      type: 'select',
      options: statusOptions,
      onEdit: (bug, value) => handleCardMove(bug.id, value as Bug['status']),
      render: (bug) => {
        const statusLabels: Record<string, string> = {
          reported: 'New',
          in_progress: 'In Progress',
          blocked: 'In Review',
          fixed: 'Completed',
          verified: 'Verified',
        };
        const statusColors: Record<string, string> = {
          reported: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          blocked: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          fixed: 'bg-green-500/20 text-green-400 border-green-500/40',
          verified: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
        };
        return (
          <Badge className={cn('text-xs', statusColors[bug.status] || statusColors.reported)}>
            {statusLabels[bug.status] || bug.status}
          </Badge>
        );
      },
    },
    {
      key: 'title',
      header: 'SUBJECT',
      sortable: true,
      render: (bug) => (
        <div>
          <div className="font-medium text-sm text-gray-50">{bug.title || 'No subject'}</div>
          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{bug.description}</div>
        </div>
      ),
    },
    {
      key: 'createdBy',
      header: 'REPORTER',
      sortable: true,
      render: (bug) => {
        const reporter = bug.createdBy?.split('@')[0] || bug.createdBy || 'Unknown';
        return (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-xs text-gray-300">U</span>
            </div>
            <span className="text-xs text-gray-400">{reporter}</span>
          </div>
        );
      },
    },
    {
      key: 'severity',
      header: 'SEVERITY',
      sortable: true,
      type: 'badge',
      render: (bug) => {
        const colors: Record<string, string> = {
          critical: 'bg-red-500/20 text-red-400 border-red-500/40',
          high: 'bg-red-500/20 text-red-400 border-red-500/40',
          medium: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          low: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
        };
        const labels: Record<string, string> = {
          critical: 'Critical',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };
        return (
          <Badge className={cn('text-xs capitalize', colors[bug.severity])}>
            {labels[bug.severity] || bug.severity}
          </Badge>
        );
      },
    },
    {
      key: 'platform',
      header: 'BUG TYPE',
      sortable: true,
      render: (bug) => {
        const bugTypeLabels: Record<string, string> = {
          ios: 'iOS Bug',
          web: 'General Bug',
          admin: 'Admin Bug',
          backend: 'Backend Bug',
        };
        // Map platform to bug type based on common patterns
        const bugType = bugTypeLabels[bug.platform] || 'General Bug';
        return (
          <span className="text-xs text-gray-400">{bugType}</span>
        );
      },
    },
    {
      key: 'dueDate',
      header: 'DUE DATE',
      sortable: false,
      render: () => (
        <span className="text-xs text-gray-600">-</span>
      ),
    },
    {
      key: 'completionDate',
      header: 'COMPLETION DATE',
      sortable: false,
      render: (bug) => {
        if (bug.status === 'fixed' || bug.status === 'verified') {
          return (
            <span className="text-xs text-gray-400">
              {format(new Date(bug.updatedAt), 'MMM d, yyyy')}
            </span>
          );
        }
        return <span className="text-xs text-gray-600">-</span>;
      },
    },
    {
      key: 'dueDate',
      header: 'DUE DATE',
      sortable: false,
      render: (bug) => (
        <span className="text-xs text-gray-400">
          {bug.dueDate ? format(new Date(bug.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'completionDate',
      header: 'COMPLETION DATE',
      sortable: false,
      render: (bug) => (
        <span className="text-xs text-gray-400">
          {bug.completionDate ? format(new Date(bug.completionDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'REPORTED',
      sortable: true,
      type: 'date',
      render: (bug) => (
        <span className="text-xs text-gray-400">
          {format(new Date(bug.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      sortable: false,
      render: (bug) => (
        <Button
          size="sm"
          variant="primary"
          accent={accent}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedBug(bug);
            setIsDrawerOpen(true);
          }}
          className="h-7 text-xs px-3"
        >
          View
        </Button>
      ),
    },
  ];

  // Combine bugs and feedback reports for board view
  const boardData = useMemo(() => {
    const allItems: Array<Bug | (FeedbackReport & { __type: 'report' })> = [
      ...bugs,
      ...feedbackReports.map(report => ({ ...report, __type: 'report' as const })),
    ];
    return allItems;
  }, [bugs, feedbackReports]);

  const boardColumns = [
    ...(project?.firebaseProjectType === 'prepcenter' && feedbackReports.length > 0
      ? [{ id: 'pending_reports', title: 'PENDING REPORTS', status: 'pending_reports' }]
      : []),
    { id: 'reported', title: 'NEW', status: 'reported' },
    { id: 'in_progress', title: 'IN PROGRESS', status: 'in_progress' },
    { id: 'blocked', title: 'IN REVIEW', status: 'blocked' },
    { id: 'fixed', title: 'COMPLETED', status: 'fixed' },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
            <div>
              <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>
                ISSUES MANAGEMENT
              </h1>
              <p className="text-sm text-gray-400">
                Track and manage bug reports
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={loading || loadingReports}
            className="h-8 px-3"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <ViewTabs
        availableViewTypes={['table', 'board', 'calendar']}
        onViewTypeChange={switchViewType}
        accent={accent}
      />

      {/* Toolbar */}
      <ViewToolbar
        searchValue={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={(newSorts) => {
          setSorts(newSorts);
          updateCurrentView({ sorts: newSorts });
        }}
        availableFields={availableFields}
        visibleColumns={currentView?.visibleColumns}
        onColumnsChange={(cols) => updateCurrentView({ visibleColumns: cols })}
        onNew={() => {
          setSelectedBug(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading bugs...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredBugs}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(bug) => {
              setSelectedBug(bug);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedBug(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        ) : viewType === 'board' ? (
          <BoardView
            data={boardData as any}
            columns={boardColumns}
            getCardData={(item: any) => {
              // Handle feedback reports
              if (item.__type === 'report') {
                const report = item as FeedbackReport;
                const severity = report.severity.toLowerCase().includes('critical') ? 'critical' :
                  report.severity.toLowerCase().includes('high') ? 'high' :
                  report.severity.toLowerCase().includes('medium') ? 'medium' : 'low';
                return {
                  title: report.subject || 'No subject',
                  subtitle: report.description ? report.description.substring(0, 60) + (report.description.length > 60 ? '...' : '') : undefined,
                  badges: [
                    { 
                      label: severity.charAt(0).toUpperCase() + severity.slice(1), 
                      variant: severity as 'critical' | 'high' | 'medium' | 'low'
                    },
                    { 
                      label: 'REPORT', 
                      variant: 'secondary' 
                    },
                  ],
                  updatedAt: new Date(report.timestamp),
                  userId: report.name || report.email?.split('@')[0] || 'user',
                };
              }
              // Handle bugs
              const bug = item as Bug;
              const badges = [
                { 
                  label: bug.severity.charAt(0).toUpperCase() + bug.severity.slice(1), 
                  variant: bug.severity as 'critical' | 'high' | 'medium' | 'low'
                },
                { 
                  label: bug.platform.toUpperCase(), 
                  variant: 'secondary' 
                },
              ];
              
              // Add indicator if bug was converted from a report
              if (bug.convertedFromReportId) {
                badges.push({
                  label: 'FROM REPORT',
                  variant: 'secondary',
                  color: 'orange',
                });
              }
              
              return {
                title: bug.title,
                subtitle: bug.description ? bug.description.substring(0, 60) + (bug.description.length > 60 ? '...' : '') : undefined,
                badges,
                updatedAt: new Date(bug.updatedAt),
                userId: bug.createdBy?.split('@')[0] || 'user',
              };
            }}
            onCardClick={(item: any) => {
              // Only handle click if not currently dragging
              // Reports don't open drawer - they use convert button instead
              if (item.__type !== 'report') {
                setSelectedBug(item as Bug);
                setIsDrawerOpen(true);
              }
            }}
            onCardConvert={(itemId: string) => {
              // Convert report to bug
              handleConvertReport(itemId);
            }}
            onCardMove={async (itemId: string, newStatus: string) => {
              try {
                // Only allow moving bugs, not reports
                const item = boardData.find(i => i.id === itemId);
                if (item && '__type' in item && item.__type === 'report') {
                  // Reports can't be moved - they need to be converted first
                  console.log('Cannot move report, must convert first');
                  return;
                }
                if (newStatus !== 'pending_reports') {
                  console.log('Calling handleCardMove with:', itemId, newStatus);
                  await handleCardMove(itemId, newStatus as Bug['status']);
                } else {
                  console.log('Cannot drop on pending_reports column');
                }
              } catch (error) {
                console.error('Error in onCardMove callback:', error);
                // Error is already handled in handleCardMove
              }
            }}
            onAddCard={(status) => {
              if (status !== 'pending_reports') {
                setSelectedBug({ ...selectedBug, status: status as Bug['status'] } as Bug);
                setIsDrawerOpen(true);
              }
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredBugs}
            getDate={(bug) => bug.dueDate ? new Date(bug.dueDate) : (bug.updatedAt ? new Date(bug.updatedAt) : new Date(bug.createdAt))}
            getTitle={(bug) => bug.title}
            getStatus={(bug) => bug.status}
            getColor={(bug) => {
              if (bug.severity === 'critical') return '#ef4444'; // red
              if (bug.severity === 'high') return '#f97316'; // orange
              if (bug.severity === 'medium') return '#eab308'; // yellow
              return '#22c55e'; // green
            }}
            onItemClick={(bug) => {
              setSelectedBug(bug);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedBug(null);
        }}
        title={selectedBug?.title || 'New Bug'}
        onTitleChange={(title) => {
          if (selectedBug) {
            handleUpdate({ title });
          }
        }}
        properties={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedBug?.status || 'reported',
            options: statusOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ status: value as Bug['status'] });
              }
            },
          },
          {
            key: 'severity',
            label: 'Severity',
            type: 'select',
            value: selectedBug?.severity || 'medium',
            options: severityOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ severity: value as Bug['severity'] });
              }
            },
          },
          {
            key: 'platform',
            label: 'Platform',
            type: 'select',
            value: selectedBug?.platform || 'web',
            options: platformOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ platform: value as Bug['platform'] });
              }
            },
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            type: 'date',
            value: selectedBug?.dueDate,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ dueDate: value });
              }
            },
          },
          {
            key: 'completionDate',
            label: 'Completion Date',
            type: 'date',
            value: selectedBug?.completionDate,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ completionDate: value });
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedBug?.description || '',
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ description: value });
              }
            },
            placeholder: 'Describe the bug...',
          },
          {
            key: 'stepsToReproduce',
            label: 'Steps to Reproduce',
            value: selectedBug?.stepsToReproduce || '',
            onChange: (value: string) => {
              if (selectedBug) {
                handleUpdate({ stepsToReproduce: value });
              }
            },
            placeholder: 'Describe how to reproduce the bug...',
          },
          {
            key: 'expectedBehavior',
            label: 'Expected Behavior',
            value: selectedBug?.expectedBehavior || '',
            onChange: (value: string) => {
              if (selectedBug) {
                handleUpdate({ expectedBehavior: value });
              }
            },
            placeholder: 'What should happen...',
          },
          {
            key: 'actualBehavior',
            label: 'Actual Behavior',
            value: selectedBug?.actualBehavior || '',
            onChange: (value: string) => {
              if (selectedBug) {
                handleUpdate({ actualBehavior: value });
              }
            },
            placeholder: 'What actually happens...',
          },
          {
            key: 'notes',
            label: 'Notes',
            value: selectedBug?.notes || '',
            onChange: (value: string) => {
              if (selectedBug) {
                handleUpdate({ notes: value });
              }
            },
            placeholder: 'Add internal notes about this bug...',
          },
        ]}
        metadata={selectedBug ? {
          createdAt: selectedBug.createdAt,
          updatedAt: selectedBug.updatedAt,
          createdBy: selectedBug.createdBy,
        } : undefined}
        onSave={() => {
          if (selectedBug) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Bug' });
          }
        }}
        onDelete={selectedBug ? handleDelete : undefined}
        onUnconvert={convertedReportId ? () => handleUnconvertBug(selectedBug!.id) : undefined}
        onCopyDetails={selectedBug ? handleCopyDetails : undefined}
        copyDetailsText={selectedBug ? formatBugDetailsForCopy(selectedBug) : undefined}
        reporterEmail={selectedBug ? getReporterEmail(selectedBug) : null}
        onGenerateEmail={selectedBug && projectId ? async () => {
          if (!projectId) throw new Error('No project ID');
          return await handleGenerateEmail(projectId, selectedBug.id);
        } : undefined}
        onSendEmail={selectedBug && projectId ? async (subject: string, body: string) => {
          if (!projectId) throw new Error('No project ID');
          await handleSendEmail(projectId, selectedBug.id, subject, body);
          // Reload bugs to get updated email metadata
          const updated = await loadBugs(projectId);
          if (updated) {
            setBugs(updated);
            const updatedBug = updated.find(b => b.id === selectedBug.id);
            if (updatedBug) setSelectedBug(updatedBug);
          }
        } : undefined}
        lastEmailSent={selectedBug?.lastEmailSent}
        lastEmailSubject={selectedBug?.lastEmailSubject}
        accent={accent}
      />
    </div>
  );
}

export default function BugsPage() {
  const { projectId } = useProject();
  
  return (
    <ViewProvider moduleName="bugs" defaultViewType="board">
      <BugsContent />
    </ViewProvider>
  );
}
