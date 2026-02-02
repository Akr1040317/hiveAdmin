'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useServerAction } from '@/hooks/useServerAction';
import {
  getContentSchedules,
  upsertContentSchedule,
  syncRequirements,
  ContentSchedule,
  ContentRequirementType,
} from '@/app/actions/content-requirements';
import { useAuth } from '@/contexts/AuthContext';
import { getContentTypeLabel } from '@/lib/content-requirements';

const CONTENT_TYPES: ContentRequirementType[] = ['video', 'article', 'tips_tricks', 'word_of_the_day'];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function SchedulePage() {
  const { project, projectId } = useProject();
  const { user } = useAuth();
  const accentClasses = project?.accentClasses;

  const [schedules, setSchedules] = useState<Record<ContentRequirementType, ContentSchedule | null>>({
    video: null,
    article: null,
    tips_tricks: null,
    word_of_the_day: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);

  const { execute: loadSchedules } = useServerAction(getContentSchedules);
  const { execute: saveSchedule } = useServerAction(upsertContentSchedule);
  const { execute: syncReqs } = useServerAction(syncRequirements);

  useEffect(() => {
    if (projectId) {
      loadSchedules(projectId).then((data) => {
        if (data) {
          const scheduleMap: Record<ContentRequirementType, ContentSchedule | null> = {
            video: null,
            article: null,
            tips_tricks: null,
            word_of_the_day: null,
          };
          data.forEach((schedule: ContentSchedule) => {
            scheduleMap[schedule.contentType] = schedule;
          });
          setSchedules(scheduleMap);
        }
        setLoading(false);
      });
    }
  }, [projectId]);

  const handleSaveSchedule = async (contentType: ContentRequirementType) => {
    if (!projectId) return;

    setSaving((prev) => ({ ...prev, [contentType]: true }));

    const currentSchedule = schedules[contentType];
    const scheduleData: Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      contentType,
      enabled: currentSchedule?.enabled ?? false,
      dayOfWeek: contentType === 'word_of_the_day' ? undefined : currentSchedule?.dayOfWeek ?? 1,
      timeOfDay: currentSchedule?.timeOfDay ?? '09:00',
    };

    try {
      await saveSchedule(projectId, scheduleData);
      const updated = await loadSchedules(projectId);
      if (updated) {
        const scheduleMap: Record<ContentRequirementType, ContentSchedule | null> = {
          video: null,
          article: null,
          tips_tricks: null,
          word_of_the_day: null,
        };
        updated.forEach((schedule: ContentSchedule) => {
          scheduleMap[schedule.contentType] = schedule;
        });
        setSchedules(scheduleMap);
      }
    } finally {
      setSaving((prev) => ({ ...prev, [contentType]: false }));
    }
  };

  const handleSyncRequirements = async () => {
    if (!projectId) return;
    setSyncing(true);
    try {
      await syncReqs(projectId);
      alert('Requirements synced successfully!');
    } catch (error) {
      alert('Error syncing requirements');
    } finally {
      setSyncing(false);
    }
  };

  const updateSchedule = (contentType: ContentRequirementType, updates: Partial<ContentSchedule>) => {
    setSchedules((prev) => {
      const current = prev[contentType];
      return {
        ...prev,
        [contentType]: current
          ? { ...current, ...updates }
          : ({
              id: '',
              projectId: projectId!,
              contentType,
              enabled: false,
              dayOfWeek: contentType === 'word_of_the_day' ? undefined : 1,
              timeOfDay: '09:00',
              createdAt: new Date(),
              updatedAt: new Date(),
              ...updates,
            } as ContentSchedule),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading schedules...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
            <div>
              <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Content Schedules</h1>
              <p className="text-sm text-gray-400">Configure publishing schedules for each content type</p>
            </div>
          </div>
          <Button
            onClick={handleSyncRequirements}
            disabled={syncing}
            accent
          >
            {syncing ? 'Syncing...' : 'Sync Requirements'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {CONTENT_TYPES.map((contentType) => {
            const schedule = schedules[contentType];
            const isDaily = contentType === 'word_of_the_day';
            const isSaving = saving[contentType] || false;

            return (
              <Card key={contentType} className="bg-background-card/50 border-border-subtle">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{getContentTypeLabel(contentType)}</CardTitle>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule?.enabled ?? false}
                        onChange={(e) => updateSchedule(contentType, { enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border-subtle bg-background-card text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-400">Enabled</span>
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!isDaily && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Day of Week
                        </label>
                        <Select
                          value={schedule?.dayOfWeek?.toString() ?? '1'}
                          onChange={(e) =>
                            updateSchedule(contentType, { dayOfWeek: parseInt(e.target.value, 10) })
                          }
                          disabled={!schedule?.enabled}
                        >
                          {DAYS_OF_WEEK.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Publish Time
                      </label>
                      <Input
                        type="time"
                        value={schedule?.timeOfDay ?? '09:00'}
                        onChange={(e) => updateSchedule(contentType, { timeOfDay: e.target.value })}
                        disabled={!schedule?.enabled}
                        className="w-32"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {isDaily
                          ? 'Time to publish daily content'
                          : 'Time to publish weekly content'}
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => handleSaveSchedule(contentType)}
                        disabled={isSaving || !schedule?.enabled}
                        accent
                        size="sm"
                      >
                        {isSaving ? 'Saving...' : 'Save Schedule'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
