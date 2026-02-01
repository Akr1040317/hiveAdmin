'use server';

import { requireAuth } from '@/lib/firebase/server-auth';
import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
} from '@/lib/firebase/data-access';
import { ProjectId } from '@/lib/projects';
import { getContent } from './content';
import {
  calculateWeekStart,
  formatPeriodKey,
  isContentInPeriod,
  getNextPublishDate,
  getPeriodStart,
  getPeriodEnd,
} from '@/lib/content-requirements';

export type ContentRequirementType = 'video' | 'article' | 'tips_tricks' | 'word_of_the_day';

export interface ContentRequirement {
  id: string;
  projectId: ProjectId;
  contentType: ContentRequirementType;
  periodType: 'weekly' | 'daily';
  periodStart: Date;
  targetPublishTime?: string; // "09:00" format
  status: 'pending' | 'met' | 'missed';
  confirmedBy?: string; // User email
  confirmedAt?: Date;
  contentId?: string; // Link to content that satisfies requirement
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentSchedule {
  id: string;
  projectId: ProjectId;
  contentType: ContentRequirementType;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly, undefined for daily
  timeOfDay?: string; // "09:00" format
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceStatus {
  contentType: ContentRequirementType;
  total: number;
  met: number;
  pending: number;
  missed: number;
  complianceRate: number; // 0-100
}

// Schedule Management

export async function getContentSchedules(
  projectId: ProjectId,
  token?: string | null
): Promise<ContentSchedule[]> {
  await requireAuth(token);
  return getCollectionData<ContentSchedule>(projectId, 'contentSchedules');
}

export async function getContentSchedule(
  projectId: ProjectId,
  contentType: ContentRequirementType,
  token?: string | null
): Promise<ContentSchedule | null> {
  await requireAuth(token);
  const schedules = await queryCollection<ContentSchedule>(
    projectId,
    'contentSchedules',
    (query) => query.where('contentType', '==', contentType).limit(1)
  );
  return schedules.length > 0 ? schedules[0] : null;
}

export async function createContentSchedule(
  projectId: ProjectId,
  data: Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<ContentSchedule>(projectId, 'contentSchedules', data);
}

export async function updateContentSchedule(
  projectId: ProjectId,
  scheduleId: string,
  data: Partial<Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<ContentSchedule>(projectId, 'contentSchedules', scheduleId, data);
}

export async function upsertContentSchedule(
  projectId: ProjectId,
  data: Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  const existing = await getContentSchedule(projectId, data.contentType, token);
  
  if (existing) {
    await updateContentSchedule(projectId, existing.id, data, token);
    return existing.id;
  } else {
    return createContentSchedule(projectId, data, token);
  }
}

// Requirement Management

export async function getContentRequirements(
  projectId: ProjectId,
  filters?: {
    contentType?: ContentRequirementType;
    status?: ContentRequirement['status'];
    periodType?: 'weekly' | 'daily';
    startDate?: Date;
    endDate?: Date;
  },
  token?: string | null
): Promise<ContentRequirement[]> {
  await requireAuth(token);
  
  // Build query - Firestore only supports one range query, so we'll filter in memory for dates
  let requirements = await queryCollection<ContentRequirement>(
    projectId,
    'contentRequirements',
    (query) => {
      let q: any = query;
      
      // Apply equality filters (can have multiple)
      if (filters?.contentType) {
        q = q.where('contentType', '==', filters.contentType);
      }
      if (filters?.status) {
        q = q.where('status', '==', filters.status);
      }
      if (filters?.periodType) {
        q = q.where('periodType', '==', filters.periodType);
      }
      
      // If we have date filters, use periodStart as the range (only one range query allowed)
      if (filters?.startDate && !filters?.endDate) {
        q = q.where('periodStart', '>=', filters.startDate);
      } else if (filters?.endDate && !filters?.startDate) {
        q = q.where('periodStart', '<=', filters.endDate);
      } else if (filters?.startDate && filters?.endDate) {
        // Use startDate for range query, filter endDate in memory
        q = q.where('periodStart', '>=', filters.startDate);
      }
      
      return q;
    }
  );

  // Filter by date range in memory if both dates provided (Firestore limitation)
  if (filters?.startDate && filters?.endDate) {
    requirements = requirements.filter(req => {
      const periodStart = req.periodStart instanceof Date 
        ? req.periodStart 
        : new Date(req.periodStart);
      return periodStart >= filters.startDate! && periodStart <= filters.endDate!;
    });
  } else if (filters?.endDate && filters?.startDate) {
    // Already filtered by startDate in query, just check endDate
    requirements = requirements.filter(req => {
      const periodStart = req.periodStart instanceof Date 
        ? req.periodStart 
        : new Date(req.periodStart);
      return periodStart <= filters.endDate!;
    });
  }

  return requirements;
}

export async function getContentRequirement(
  projectId: ProjectId,
  requirementId: string,
  token?: string | null
): Promise<ContentRequirement | null> {
  await requireAuth(token);
  return getDocumentData<ContentRequirement>(projectId, 'contentRequirements', requirementId);
}

export async function createContentRequirement(
  projectId: ProjectId,
  data: Omit<ContentRequirement, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<ContentRequirement>(projectId, 'contentRequirements', data);
}

export async function updateContentRequirement(
  projectId: ProjectId,
  requirementId: string,
  data: Partial<Omit<ContentRequirement, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<ContentRequirement>(projectId, 'contentRequirements', requirementId, data);
}

// Requirement Generation

export async function generateWeeklyRequirements(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  contentType: ContentRequirementType,
  schedule: ContentSchedule,
  token?: string | null
): Promise<string[]> {
  await requireAuth(token);
  
  const requirementIds: string[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekStart = calculateWeekStart(currentDate);
    const periodKey = formatPeriodKey(weekStart, 'weekly');
    
    // Check if requirement already exists
    const existing = await queryCollection<ContentRequirement>(
      projectId,
      'contentRequirements',
      (query) =>
        query
          .where('contentType', '==', contentType)
          .where('periodType', '==', 'weekly')
          .where('periodStart', '==', weekStart)
          .limit(1)
    );
    
    if (existing.length === 0) {
      const requirementId = await createContentRequirement(
        projectId,
        {
          projectId,
          contentType,
          periodType: 'weekly',
          periodStart: weekStart,
          targetPublishTime: schedule.timeOfDay,
          status: 'pending',
        },
        token
      );
      requirementIds.push(requirementId);
    }
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return requirementIds;
}

export async function generateDailyRequirements(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  contentType: ContentRequirementType,
  schedule: ContentSchedule,
  token?: string | null
): Promise<string[]> {
  await requireAuth(token);
  
  const requirementIds: string[] = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    const periodKey = formatPeriodKey(dayStart, 'daily');
    
    // Check if requirement already exists
    const existing = await queryCollection<ContentRequirement>(
      projectId,
      'contentRequirements',
      (query) =>
        query
          .where('contentType', '==', contentType)
          .where('periodType', '==', 'daily')
          .where('periodStart', '==', dayStart)
          .limit(1)
    );
    
    if (existing.length === 0) {
      const requirementId = await createContentRequirement(
        projectId,
        {
          projectId,
          contentType,
          periodType: 'daily',
          periodStart: dayStart,
          targetPublishTime: schedule.timeOfDay,
          status: 'pending',
        },
        token
      );
      requirementIds.push(requirementId);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return requirementIds;
}

export async function syncRequirements(
  projectId: ProjectId,
  startDate?: Date,
  endDate?: Date,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  const schedules = await getContentSchedules(projectId, token);
  const enabledSchedules = schedules.filter(s => s.enabled);
  
  const start = startDate || new Date();
  const end = endDate || new Date();
  end.setDate(end.getDate() + 90); // Default to 90 days ahead
  
  for (const schedule of enabledSchedules) {
    if (schedule.contentType === 'word_of_the_day') {
      await generateDailyRequirements(projectId, start, end, schedule.contentType, schedule, token);
    } else {
      await generateWeeklyRequirements(projectId, start, end, schedule.contentType, schedule, token);
    }
  }
}

// Compliance Checking

export async function checkRequirementCompliance(
  projectId: ProjectId,
  requirementId?: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  const requirements = requirementId
    ? [await getContentRequirement(projectId, requirementId, token)].filter(Boolean) as ContentRequirement[]
    : await getContentRequirements(projectId, { status: 'pending' }, token);
  
  const allContent = await getContent(projectId, token);
  
  for (const requirement of requirements) {
    if (!requirement) continue;
    
    const periodStart = getPeriodStart(requirement.periodStart, requirement.periodType);
    const periodEnd = getPeriodEnd(requirement.periodStart, requirement.periodType);
    
    // Find content that matches this requirement
    const matchingContent = allContent.find(content => {
      if (content.contentType !== requirement.contentType) return false;
      if (!content.publishAt) return false;
      
      const publishDate = new Date(content.publishAt);
      return publishDate >= periodStart && publishDate <= periodEnd;
    });
    
    if (matchingContent) {
      await updateContentRequirement(
        projectId,
        requirement.id,
        {
          status: 'met',
          contentId: matchingContent.id,
        },
        token
      );
    } else {
      // Check if requirement period has passed
      const now = new Date();
      if (periodEnd < now && requirement.status === 'pending') {
        await updateContentRequirement(
          projectId,
          requirement.id,
          { status: 'missed' },
          token
        );
      }
    }
  }
}

export async function confirmRequirement(
  projectId: ProjectId,
  requirementId: string,
  contentId?: string,
  confirmedBy?: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  await updateContentRequirement(
    projectId,
    requirementId,
    {
      status: 'met',
      contentId,
      confirmedBy,
      confirmedAt: new Date(),
    },
    token
  );
}

export async function markRequirementMissed(
  projectId: ProjectId,
  requirementId: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  await updateContentRequirement(
    projectId,
    requirementId,
    { status: 'missed' },
    token
  );
}

// Compliance Queries

export async function getComplianceStatus(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  token?: string | null
): Promise<ComplianceStatus[]> {
  await requireAuth(token);
  
  const requirements = await getContentRequirements(
    projectId,
    { startDate, endDate },
    token
  );
  
  const statusByType: Record<ContentRequirementType, ComplianceStatus> = {
    video: { contentType: 'video', total: 0, met: 0, pending: 0, missed: 0, complianceRate: 0 },
    article: { contentType: 'article', total: 0, met: 0, pending: 0, missed: 0, complianceRate: 0 },
    tips_tricks: { contentType: 'tips_tricks', total: 0, met: 0, pending: 0, missed: 0, complianceRate: 0 },
    word_of_the_day: { contentType: 'word_of_the_day', total: 0, met: 0, pending: 0, missed: 0, complianceRate: 0 },
  };
  
  for (const req of requirements) {
    const status = statusByType[req.contentType];
    status.total++;
    
    if (req.status === 'met') status.met++;
    else if (req.status === 'pending') status.pending++;
    else if (req.status === 'missed') status.missed++;
  }
  
  // Calculate compliance rates
  for (const contentType in statusByType) {
    const status = statusByType[contentType as ContentRequirementType];
    status.complianceRate = status.total > 0
      ? Math.round((status.met / status.total) * 100)
      : 0;
  }
  
  return Object.values(statusByType).filter(s => s.total > 0);
}

export async function getUpcomingRequirements(
  projectId: ProjectId,
  daysAhead: number = 7,
  token?: string | null
): Promise<ContentRequirement[]> {
  await requireAuth(token);
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);
  
  const requirements = await getContentRequirements(
    projectId,
    { startDate, endDate },
    token
  );
  
  return requirements.sort((a, b) => 
    new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
  );
}
