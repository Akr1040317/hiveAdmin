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
import { serializeForClient } from '@/lib/utils/serialize';

export type GoalCategory = 
  | 'tasks' 
  | 'features' 
  | 'bugs' 
  | 'content' 
  | 'meetings' 
  | 'operations' 
  | 'team' 
  | 'time-based' 
  | 'percentage' 
  | 'multi-metric'
  | 'general';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  type: 'monthly' | 'weekly';
  goalType: 'numerical' | 'yesno';
  category?: GoalCategory; // Category/template type
  // For monthly goals: YYYY-MM format (e.g., "2026-02")
  // For weekly goals: ISO week string (e.g., "2026-W05")
  period: string;
  // For numerical goals
  targetValue?: number;
  currentValue?: number;
  unit?: string; // e.g., "items", "hours", "percent"
  // For yes/no goals
  completed?: boolean;
  completedAt?: Date;
  // Optional linking to other entities
  linkedEntityType?: 'task' | 'feature' | 'bug' | 'meeting' | 'content';
  linkedEntityId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export async function getGoals(
  projectId: ProjectId,
  token?: string | null,
  period?: string,
  type?: 'monthly' | 'weekly'
): Promise<Goal[]> {
  try {
    await requireAuth(token);
    
    let goals: Goal[];
    
    if (period && type) {
      // Query by both period and type
      goals = await queryCollection<Goal>(projectId, 'goals', (query) =>
        query.where('period', '==', period).where('type', '==', type)
      );
    } else if (period) {
      // Query by period only
      goals = await queryCollection<Goal>(projectId, 'goals', (query) =>
        query.where('period', '==', period)
      );
    } else if (type) {
      // Query by type only
      goals = await queryCollection<Goal>(projectId, 'goals', (query) =>
        query.where('type', '==', type)
      );
    } else {
      // Get all goals
      goals = await getCollectionData<Goal>(projectId, 'goals');
    }
    
    // Recursively serialize all Date objects and non-serializable values
    return serializeForClient(goals) as Goal[];
  } catch (error: any) {
    console.error('[getGoals] Error:', error.message);
    console.error('[getGoals] Stack:', error.stack);
    // Re-throw with more context
    throw new Error(`Failed to get goals: ${error.message}`);
  }
}

export async function getGoal(projectId: ProjectId, goalId: string, token?: string | null): Promise<Goal | null> {
  await requireAuth(token);
  const goal = await getDocumentData<Goal>(projectId, 'goals', goalId);
  if (!goal) return null;
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(goal) as Goal;
}

export async function createGoal(
  projectId: ProjectId,
  data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  token?: string | null
): Promise<string> {
  try {
    const user = await requireAuth(token);
    
    // Build goal data based on goal type, excluding undefined values
    const goalData: any = {
      title: data.title,
      description: data.description,
      type: data.type,
      goalType: data.goalType,
      period: data.period,
      category: data.category || 'general',
      createdBy: user.email || 'unknown',
    };
    
    // Add optional linked entity fields
    if (data.linkedEntityType) {
      goalData.linkedEntityType = data.linkedEntityType;
    }
    if (data.linkedEntityId) {
      goalData.linkedEntityId = data.linkedEntityId;
    }
    
    // Add fields specific to goal type
    if (data.goalType === 'numerical') {
      goalData.targetValue = data.targetValue ?? 100;
      goalData.currentValue = data.currentValue ?? 0;
      if (data.unit) {
        goalData.unit = data.unit;
      }
    } else if (data.goalType === 'yesno') {
      goalData.completed = data.completed ?? false;
      if (data.completed && data.completedAt) {
        goalData.completedAt = data.completedAt;
      }
    }
    
    return await createDocument<Goal>(projectId, 'goals', goalData);
  } catch (error: any) {
    console.error('[createGoal] Error:', error.message);
    console.error('[createGoal] Stack:', error.stack);
    // Re-throw with more context
    throw new Error(`Failed to create goal: ${error.message}`);
  }
}

export async function updateGoal(
  projectId: ProjectId,
  goalId: string,
  data: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  try {
    await requireAuth(token);
    
    // Build update data, excluding undefined values
    const updateData: any = {};
    
    // Copy defined fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.goalType !== undefined) updateData.goalType = data.goalType;
    if (data.period !== undefined) updateData.period = data.period;
    
    // Handle numerical goal fields
    if (data.targetValue !== undefined) updateData.targetValue = data.targetValue;
    if (data.currentValue !== undefined) updateData.currentValue = data.currentValue;
    if (data.unit !== undefined) updateData.unit = data.unit;
    
    // Handle yes/no goal fields
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      if (data.completed === true) {
        // If completing, set completedAt if not already set
        const existingGoal = await getDocumentData<Goal>(projectId, 'goals', goalId);
        if (existingGoal && !existingGoal.completedAt) {
          updateData.completedAt = new Date();
        } else if (data.completedAt !== undefined) {
          updateData.completedAt = data.completedAt;
        }
      }
      // If uncompleting (completed === false), we don't include completedAt
      // The field will remain in the document but won't affect functionality
    }
    
    return await updateDocument<Goal>(projectId, 'goals', goalId, updateData);
  } catch (error: any) {
    console.error('[updateGoal] Error:', error.message);
    console.error('[updateGoal] Stack:', error.stack);
    // Re-throw with more context
    throw new Error(`Failed to update goal: ${error.message}`);
  }
}

export async function deleteGoal(projectId: ProjectId, goalId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'goals', goalId);
}

export async function getGoalsByPeriod(
  projectId: ProjectId,
  token: string | null,
  period: string,
  type: 'monthly' | 'weekly'
): Promise<Goal[]> {
  await requireAuth(token);
  const goals = await queryCollection<Goal>(projectId, 'goals', (query) =>
    query.where('period', '==', period).where('type', '==', type)
  );
  
  return serializeForClient(goals) as Goal[];
}
