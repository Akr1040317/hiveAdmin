'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Meeting, getMeetings, createMeeting, updateMeeting, deleteMeeting } from '@/app/actions/meetings';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function MeetingsPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { execute: loadMeetings, loading } = useServerAction(getMeetings);
  const { execute: handleCreateMeeting } = useServerAction(createMeeting);
  const { execute: handleUpdateMeeting } = useServerAction(updateMeeting);
  const { execute: handleDeleteMeeting } = useServerAction(deleteMeeting);

  useEffect(() => {
    if (projectId) {
      loadMeetings(projectId).then((data) => {
        if (data) setMeetings(data);
      });
    }
  }, [projectId]);

  const [formData, setFormData] = useState({
    title: '',
    startsAt: '',
    meetingType: 'internal' as Meeting['meetingType'],
    agenda: '',
    notes: '',
    actionItems: [] as string[],
  });
  const [actionItemInput, setActionItemInput] = useState('');

  useEffect(() => {
    if (selectedMeeting) {
      setFormData({
        title: selectedMeeting.title,
        startsAt: new Date(selectedMeeting.startsAt).toISOString().slice(0, 16),
        meetingType: selectedMeeting.meetingType,
        agenda: selectedMeeting.agenda,
        notes: selectedMeeting.notes,
        actionItems: selectedMeeting.actionItems || [],
      });
    } else {
      setFormData({
        title: '',
        startsAt: '',
        meetingType: 'internal',
        agenda: '',
        notes: '',
        actionItems: [],
      });
    }
  }, [selectedMeeting, isFormOpen]);

  const handleCreate = async (data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    await handleCreateMeeting(projectId, {
      ...data,
      startsAt: new Date(data.startsAt),
    });
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
  };

  const handleUpdate = async (data: Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!projectId || !selectedMeeting) return;
    await handleUpdateMeeting(projectId, selectedMeeting.id, {
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    });
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
    setSelectedMeeting(null);
  };

  const filteredMeetings = meetings.filter((meeting) => {
    if (typeFilter && meeting.meetingType !== typeFilter) return false;
    return true;
  });

  const columns: Column<Meeting>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (meeting) => (
        <div>
          <div className="font-medium">{meeting.title}</div>
          <div className="text-sm text-gray-400">
            {new Date(meeting.startsAt).toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      key: 'meetingType',
      header: 'Type',
      render: (meeting) => (
        <Badge variant="default" className="capitalize">
          {meeting.meetingType}
        </Badge>
      ),
    },
    {
      key: 'agenda',
      header: 'Agenda',
      render: (meeting) => (
        <div className="text-sm text-gray-400 line-clamp-2 max-w-md">
          {meeting.agenda}
        </div>
      ),
    },
    {
      key: 'actionItems',
      header: 'Action Items',
      render: (meeting) => (
        <Badge variant="default">
          {meeting.actionItems?.length || 0} items
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (meeting) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMeeting(meeting);
              setIsFormOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this meeting?')) {
                handleDeleteMeeting(projectId!, meeting.id).then(() => {
                  loadMeetings(projectId!).then((data) => {
                    if (data) setMeetings(data);
                  });
                });
              }
            }}
            className="text-red-400 hover:text-red-300"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const addActionItem = () => {
    if (actionItemInput.trim() && !formData.actionItems.includes(actionItemInput.trim())) {
      setFormData({ ...formData, actionItems: [...formData.actionItems, actionItemInput.trim()] });
      setActionItemInput('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold mb-2', accentClasses?.text)}>
            Meetings
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Meeting agendas, notes, and action items
          </p>
        </div>
        <Button variant="primary" accent onClick={() => {
          setSelectedMeeting(null);
          setIsFormOpen(true);
        }}>
          New Meeting
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading meetings...</div>
          ) : (
            <DataTable
              data={filteredMeetings}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search meetings..."
              filters={[
                {
                  key: 'meetingType',
                  label: 'Type',
                  options: [
                    { value: 'internal', label: 'Internal' },
                    { value: 'partner', label: 'Partner' },
                    { value: 'ops', label: 'Ops' },
                    { value: 'review', label: 'Review' },
                  ],
                  value: typeFilter,
                  onChange: setTypeFilter,
                },
              ]}
              emptyMessage="No meetings found. Create your first meeting!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedMeeting(null);
        }}
        title={selectedMeeting ? 'Edit Meeting' : 'Create Meeting'}
        accent
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedMeeting) {
              await handleUpdate(formData);
            } else {
              await handleCreate(formData as Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>);
            }
            setIsFormOpen(false);
            setSelectedMeeting(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required accent />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date & Time</label>
              <Input type="datetime-local" value={formData.startsAt} onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })} required accent />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <Select value={formData.meetingType} onChange={(e) => setFormData({ ...formData, meetingType: e.target.value as Meeting['meetingType'] })} accent>
                <option value="internal">Internal</option>
                <option value="partner">Partner</option>
                <option value="ops">Ops</option>
                <option value="review">Review</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Agenda</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-violet-500/40 focus:border-violet-500/30"
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-violet-500/40 focus:border-violet-500/30"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Action Items</label>
            <div className="flex gap-2 mb-2">
              <Input value={actionItemInput} onChange={(e) => setActionItemInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addActionItem(); } }} placeholder="Add action item..." accent />
              <Button type="button" onClick={addActionItem} variant="secondary">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.actionItems.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-background-hover rounded text-sm text-gray-300">
                  {item}
                  <button type="button" onClick={() => setFormData({ ...formData, actionItems: formData.actionItems.filter((_, i) => i !== idx) })} className="text-gray-400 hover:text-gray-200">×</button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsFormOpen(false); setSelectedMeeting(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" accent>{selectedMeeting ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
