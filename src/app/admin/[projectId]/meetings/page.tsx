'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { Meeting, getMeetings, createMeeting, updateMeeting, deleteMeeting, sendMeetingInvite, sendMeetingReminder, syncMeetingToGoogleCalendar, generateMeetLinkForMeeting, unsyncMeetingFromGoogleCalendar } from '@/app/actions/meetings';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';
import { getTeamMembers, supportsAssignment } from '@/lib/team-members';
import { AttendeeSelector } from '@/components/shared/AttendeeSelector';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, Clock, Calendar, Video, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

function MeetingsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [newMeetingData, setNewMeetingData] = useState<Partial<Meeting>>({
    title: 'New Meeting',
    agenda: '',
    notes: '',
    meetingType: 'internal',
    startsAt: new Date(),
    actionItems: [],
    duration: 60,
    location: '',
    attendees: [],
    reminderDays: [],
  });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);
  const [generatingMeetLink, setGeneratingMeetLink] = useState(false);

  const { execute: loadMeetings, loading } = useServerAction(getMeetings);
  const { execute: handleCreateMeeting } = useServerAction(createMeeting);
  const { execute: handleUpdateMeeting } = useServerAction(updateMeeting);
  const { execute: handleDeleteMeeting } = useServerAction(deleteMeeting);
  const { execute: handleSendInvite } = useServerAction(sendMeetingInvite);
  const { execute: handleSendReminder } = useServerAction(sendMeetingReminder);
  const { execute: handleSyncToGoogle } = useServerAction(syncMeetingToGoogleCalendar);
  const { execute: handleGenerateMeetLink } = useServerAction(generateMeetLinkForMeeting);
  const { execute: handleUnsyncFromGoogle } = useServerAction(unsyncMeetingFromGoogleCalendar);

  useEffect(() => {
    if (projectId) {
      loadMeetings(projectId).then((data) => {
        if (data) setMeetings(data);
      });
    }
  }, [projectId]);

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.agenda.toLowerCase().includes(searchLower) ||
        m.notes.toLowerCase().includes(searchLower)
      );
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(m => (m as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(m => (m as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [meetings, search, filters]);

  const handleCreate = async (data: Partial<Meeting>) => {
    if (!projectId) return;
    const newMeeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Meeting',
      startsAt: data.startsAt || new Date(),
      meetingType: data.meetingType || 'internal',
      agenda: data.agenda || '',
      notes: data.notes || '',
      actionItems: data.actionItems || [],
      duration: data.duration || 60,
      location: data.location || '',
      attendees: data.attendees || [],
      reminderDays: data.reminderDays || [],
    };
    await handleCreateMeeting(projectId, newMeeting);
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
    setIsDrawerOpen(false);
    setNewMeetingData({
      title: 'New Meeting',
      agenda: '',
      notes: '',
      meetingType: 'internal',
      startsAt: new Date(),
      actionItems: [],
      duration: 60,
      location: '',
      attendees: [],
      reminderDays: [],
    });
  };

  const handleUpdate = async (updates: Partial<Meeting>) => {
    if (!projectId || !selectedMeeting) return;
    await handleUpdateMeeting(projectId, selectedMeeting.id, updates);
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
    setSelectedMeeting({ ...selectedMeeting, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedMeeting) return;
    if (confirm('Are you sure?')) {
      await handleDeleteMeeting(projectId, selectedMeeting.id);
      const updated = await loadMeetings(projectId);
      if (updated) setMeetings(updated);
      setIsDrawerOpen(false);
      setSelectedMeeting(null);
    }
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'meetingType', label: 'Type', type: 'select' as const },
    { value: 'startsAt', label: 'Date & Time', type: 'date' as const },
  ];

  const typeOptions = [
    { value: 'internal', label: 'Internal' },
    { value: 'partner', label: 'Partner' },
    { value: 'ops', label: 'Ops' },
    { value: 'review', label: 'Review' },
  ];

  const getTypeColor = (type: string): string => {
    const t = type.toLowerCase();
    if (t === 'internal') return '#3b82f6'; // blue-500
    if (t === 'partner') return '#8b5cf6'; // purple-500
    if (t === 'ops') return '#f97316'; // orange-500
    if (t === 'review') return '#22c55e'; // green-500
    return '#6b7280'; // gray-500
  };

  const tableColumns: TableColumn<Meeting>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (m) => (
        <div>
          <div className="font-semibold text-sm text-gray-50">{m.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{format(new Date(m.startsAt), 'MMM d, yyyy h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'meetingType',
      header: 'Type',
      sortable: true,
      type: 'badge',
      render: (m) => (
        <Badge className={cn('text-xs capitalize', getTypeColor(m.meetingType) === 'bg-blue-500' && 'bg-blue-500/20 text-blue-400 border-blue-500/40', getTypeColor(m.meetingType) === 'bg-purple-500' && 'bg-purple-500/20 text-purple-400 border-purple-500/40', getTypeColor(m.meetingType) === 'bg-orange-500' && 'bg-orange-500/20 text-orange-400 border-orange-500/40', getTypeColor(m.meetingType) === 'bg-green-500' && 'bg-green-500/20 text-green-400 border-green-500/40')}>
          {m.meetingType}
        </Badge>
      ),
    },
    {
      key: 'agenda',
      header: 'Agenda',
      sortable: false,
      render: (m) => (
        <div className="text-xs text-gray-400 line-clamp-2 max-w-md">
          {m.agenda || 'No agenda'}
        </div>
      ),
    },
    {
      key: 'actionItems',
      header: 'Action Items',
      sortable: false,
      render: (m) => (
        <Badge variant="secondary" className="text-xs">
          {m.actionItems?.length || 0} {m.actionItems?.length === 1 ? 'item' : 'items'}
        </Badge>
      ),
    },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Meetings</h1>
            <p className="text-sm text-gray-400">Meeting agendas, notes, and action items</p>
          </div>
        </div>
      </div>

      <ViewTabs availableViewTypes={['table', 'calendar']} onViewTypeChange={(vt) => {
        if (vt !== 'tracker') {
          switchViewType(vt);
        }
      }} accent={accent} />

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
          setSelectedMeeting(null);
          setNewMeetingData({
            title: 'New Meeting',
            agenda: '',
            notes: '',
            meetingType: 'internal',
            startsAt: new Date(),
            actionItems: [],
            duration: 60,
            location: '',
            attendees: [],
            reminderDays: [],
          });
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading meetings...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredMeetings}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(m) => {
              setSelectedMeeting(m);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedMeeting(null);
              setNewMeetingData({
                title: 'New Meeting',
                agenda: '',
                notes: '',
                meetingType: 'internal',
                startsAt: new Date(),
                actionItems: [],
                duration: 60,
                location: '',
                attendees: [],
                reminderDays: [],
              });
              setIsDrawerOpen(true);
            }}
            emptyMessage="No meetings found. Create your first meeting!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredMeetings}
            getDate={(m) => new Date(m.startsAt)}
            getTitle={(m) => m.title}
            getStatus={(m) => m.meetingType}
            getColor={(m) => getTypeColor(m.meetingType)}
            onItemClick={(m) => {
              setSelectedMeeting(m);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No meetings found. Create your first meeting!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedMeeting(null);
          setNewMeetingData({
            title: 'New Meeting',
            agenda: '',
            notes: '',
            meetingType: 'internal',
            startsAt: new Date(),
            actionItems: [],
            duration: 60,
            location: '',
            attendees: [],
            reminderDays: [],
          });
        }}
        title={selectedMeeting?.title || newMeetingData.title || 'New Meeting'}
        onTitleChange={(title) => {
          if (selectedMeeting) {
            handleUpdate({ title });
          } else {
            setNewMeetingData(prev => ({ ...prev, title }));
          }
        }}
        properties={[
          {
            key: 'startsAt',
            label: 'Date & Time',
            type: 'date',
            value: selectedMeeting?.startsAt 
              ? format(new Date(selectedMeeting.startsAt), 'yyyy-MM-dd') 
              : newMeetingData.startsAt 
                ? format(new Date(newMeetingData.startsAt), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd'),
            onChange: (value) => {
              if (selectedMeeting) {
                const date = new Date(value);
                const existingDate = new Date(selectedMeeting.startsAt);
                date.setHours(existingDate.getHours());
                date.setMinutes(existingDate.getMinutes());
                handleUpdate({ startsAt: date });
              } else {
                const date = new Date(value);
                const existingDate = newMeetingData.startsAt ? new Date(newMeetingData.startsAt) : new Date();
                date.setHours(existingDate.getHours());
                date.setMinutes(existingDate.getMinutes());
                setNewMeetingData(prev => ({ ...prev, startsAt: date }));
              }
            },
          },
          {
            key: 'meetingType',
            label: 'Type',
            type: 'select',
            value: selectedMeeting?.meetingType || newMeetingData.meetingType || 'internal',
            options: typeOptions,
            onChange: (value) => {
              if (selectedMeeting) {
                handleUpdate({ meetingType: value as Meeting['meetingType'] });
              } else {
                setNewMeetingData(prev => ({ ...prev, meetingType: value as Meeting['meetingType'] }));
              }
            },
          },
          {
            key: 'duration',
            label: 'Duration (minutes)',
            type: 'number',
            value: selectedMeeting?.duration || newMeetingData.duration || 60,
            onChange: (value) => {
              const duration = typeof value === 'number' ? value : (parseInt(String(value)) || 60);
              if (selectedMeeting) {
                handleUpdate({ duration });
              } else {
                setNewMeetingData(prev => ({ ...prev, duration }));
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'location',
            label: 'Location',
            value: selectedMeeting?.location || newMeetingData.location || '',
            onChange: (value) => {
              if (selectedMeeting) {
                handleUpdate({ location: value });
              } else {
                setNewMeetingData(prev => ({ ...prev, location: value }));
              }
            },
            placeholder: 'Meeting location...',
          },
          {
            key: 'agenda',
            label: 'Agenda',
            value: selectedMeeting?.agenda || newMeetingData.agenda || '',
            onChange: (value) => {
              if (selectedMeeting) {
                handleUpdate({ agenda: value });
              } else {
                setNewMeetingData(prev => ({ ...prev, agenda: value }));
              }
            },
            placeholder: 'Meeting agenda...',
          },
          {
            key: 'notes',
            label: 'Notes',
            value: selectedMeeting?.notes || newMeetingData.notes || '',
            onChange: (value) => {
              if (selectedMeeting) {
                handleUpdate({ notes: value });
              } else {
                setNewMeetingData(prev => ({ ...prev, notes: value }));
              }
            },
            placeholder: 'Meeting notes...',
          },
        ]}
        metadata={selectedMeeting ? {
          createdAt: selectedMeeting.createdAt,
          updatedAt: selectedMeeting.updatedAt,
        } : undefined}
        onSave={() => {
          if (selectedMeeting) {
            setIsDrawerOpen(false);
          } else {
            handleCreate(newMeetingData);
          }
        }}
        onDelete={selectedMeeting ? handleDelete : undefined}
        accent={accent}
        customContent={
          <div className="space-y-4 mt-4">
            {/* Attendees Section */}
            {projectId && supportsAssignment(projectId) && (
              <div className="border-t border-border-subtle pt-4">
                <AttendeeSelector
                  attendees={selectedMeeting?.attendees || newMeetingData.attendees || []}
                  teamMembers={getTeamMembers(projectId)}
                  onChange={(attendees) => {
                    if (selectedMeeting) {
                      handleUpdate({ attendees });
                    } else {
                      setNewMeetingData(prev => ({ ...prev, attendees }));
                    }
                  }}
                />
              </div>
            )}

            {/* Reminder Days Section */}
            <div className="border-t border-border-subtle pt-4">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                Reminder Days Before Meeting
              </label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7].map((days) => {
                  const isSelected = (selectedMeeting?.reminderDays || newMeetingData.reminderDays || []).includes(days);
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const currentDays = selectedMeeting?.reminderDays || newMeetingData.reminderDays || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== days)
                          : [...currentDays, days];
                        if (selectedMeeting) {
                          handleUpdate({ reminderDays: newDays });
                        } else {
                          setNewMeetingData(prev => ({ ...prev, reminderDays: newDays }));
                        }
                      }}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-md border transition-colors',
                        isSelected
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-background-card text-gray-400 border-border-subtle hover:border-gray-600'
                      )}
                    >
                      {days} {days === 1 ? 'day' : 'days'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Google Calendar Integration */}
            {selectedMeeting && (
              <div className="border-t border-border-subtle pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Google Calendar
                  </label>
                  {selectedMeeting.googleCalendarSynced ? (
                    <div className="flex items-center gap-2 text-green-400 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Synced
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <XCircle className="w-3 h-3" />
                      Not synced
                    </div>
                  )}
                </div>

                {selectedMeeting.googleMeetLink && (
                  <div className="bg-background-card p-3 rounded-md border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-gray-300">Google Meet Link</span>
                    </div>
                    <a
                      href={selectedMeeting.googleMeetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 break-all"
                    >
                      {selectedMeeting.googleMeetLink}
                    </a>
                  </div>
                )}

                {selectedMeeting.googleCalendarHtmlLink && (
                  <a
                    href={selectedMeeting.googleCalendarHtmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Google Calendar
                  </a>
                )}

                <div className="flex flex-wrap gap-2">
                  {!selectedMeeting.googleCalendarSynced ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        if (!projectId || !selectedMeeting) return;
                        setSyncingToGoogle(true);
                        try {
                          await handleSyncToGoogle(projectId, selectedMeeting.id, true);
                          alert('Meeting synced to Google Calendar successfully!');
                          const updated = await loadMeetings(projectId);
                          if (updated) setMeetings(updated);
                        } catch (error) {
                          console.error('Failed to sync to Google Calendar:', error);
                          alert(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        } finally {
                          setSyncingToGoogle(false);
                        }
                      }}
                      disabled={syncingToGoogle}
                      accent={accent}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      {syncingToGoogle ? 'Syncing...' : 'Sync to Google Calendar'}
                    </Button>
                  ) : (
                    <>
                      {!selectedMeeting.googleMeetLink && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!projectId || !selectedMeeting) return;
                            setGeneratingMeetLink(true);
                            try {
                              await handleGenerateMeetLink(projectId, selectedMeeting.id);
                              alert('Google Meet link generated successfully!');
                              const updated = await loadMeetings(projectId);
                              if (updated) setMeetings(updated);
                            } catch (error) {
                              console.error('Failed to generate Meet link:', error);
                              alert(`Failed to generate Meet link: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            } finally {
                              setGeneratingMeetLink(false);
                            }
                          }}
                          disabled={generatingMeetLink}
                          className="flex items-center gap-2"
                        >
                          <Video className="w-4 h-4" />
                          {generatingMeetLink ? 'Generating...' : 'Generate Meet Link'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!projectId || !selectedMeeting) return;
                          if (!confirm('Are you sure you want to unsync this meeting from Google Calendar? The Google Calendar event will be deleted.')) {
                            return;
                          }
                          setSyncingToGoogle(true);
                          try {
                            await handleUnsyncFromGoogle(projectId, selectedMeeting.id);
                            alert('Meeting unsynced from Google Calendar successfully!');
                            const updated = await loadMeetings(projectId);
                            if (updated) setMeetings(updated);
                          } catch (error) {
                            console.error('Failed to unsync from Google Calendar:', error);
                            alert(`Failed to unsync: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          } finally {
                            setSyncingToGoogle(false);
                          }
                        }}
                        disabled={syncingToGoogle}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300"
                      >
                        <XCircle className="w-4 h-4" />
                        Unsync from Google Calendar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedMeeting && projectId && supportsAssignment(projectId) && (
              <div className="border-t border-border-subtle pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!projectId || !selectedMeeting) return;
                    const attendees = selectedMeeting.attendees || [];
                    if (attendees.length === 0) {
                      alert('Please add attendees before sending an invitation.');
                      return;
                    }
                    setSendingInvite(true);
                    try {
                      await handleSendInvite(projectId, selectedMeeting.id, attendees);
                      alert('Meeting invitation sent successfully!');
                      const updated = await loadMeetings(projectId);
                      if (updated) setMeetings(updated);
                    } catch (error) {
                      console.error('Failed to send invite:', error);
                      alert(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setSendingInvite(false);
                    }
                  }}
                  disabled={sendingInvite || !selectedMeeting.attendees || selectedMeeting.attendees.length === 0}
                  accent={accent}
                  className="flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!projectId || !selectedMeeting) return;
                    const reminderDays = selectedMeeting.reminderDays || [];
                    if (reminderDays.length === 0) {
                      alert('Please select reminder days before sending a reminder.');
                      return;
                    }
                    const daysUntil = Math.min(...reminderDays);
                    setSendingReminder(true);
                    try {
                      await handleSendReminder(projectId, selectedMeeting.id, daysUntil);
                      alert('Meeting reminder sent successfully!');
                      const updated = await loadMeetings(projectId);
                      if (updated) setMeetings(updated);
                    } catch (error) {
                      console.error('Failed to send reminder:', error);
                      alert(`Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setSendingReminder(false);
                    }
                  }}
                  disabled={sendingReminder || !selectedMeeting.reminderDays || selectedMeeting.reminderDays.length === 0}
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {sendingReminder ? 'Sending...' : 'Send Reminder'}
                </Button>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <ViewProvider moduleName="meetings" defaultViewType="table">
      <MeetingsContent />
    </ViewProvider>
  );
}
