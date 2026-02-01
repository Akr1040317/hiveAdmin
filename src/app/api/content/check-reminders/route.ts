import { NextRequest, NextResponse } from 'next/server';
import { checkContentReminders } from '@/app/actions/content';
import { getAllProjects, ProjectId } from '@/lib/projects';
import { requireAuth } from '@/lib/firebase/server-auth';

/**
 * API route to check and send content reminders
 * Can be called by external schedulers (cron jobs, etc.)
 * 
 * POST /api/content/check-reminders
 * 
 * Headers:
 * - Authorization: Bearer <token> (optional, but recommended)
 * 
 * Body (optional):
 * - projectId: specific project to check (if not provided, checks all projects)
 */
export async function POST(request: NextRequest) {
  try {
    // Try to get auth token from header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    
    // Try to authenticate (but allow unauthenticated if no token provided for external schedulers)
    let user = null;
    try {
      if (token) {
        user = await requireAuth(token);
      }
    } catch (error) {
      // If auth fails, return error
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token.' },
        { status: 401 }
      );
    }
    
    const body = await request.json().catch(() => ({}));
    const projectId = body.projectId;
    
    const results: Record<string, { checked: number; remindersSent: number; errors: number }> = {};
    
    if (projectId) {
      // Check specific project
      const result = await checkContentReminders(projectId, token);
      results[projectId] = result;
    } else {
      // Check all projects
      const projects = getAllProjects();
      for (const project of projects) {
        try {
          const result = await checkContentReminders(project.id, token);
          results[project.id] = result;
        } catch (error) {
          console.error(`[Content Reminder API] Error checking project ${project.id}:`, error);
          results[project.id] = { checked: 0, remindersSent: 0, errors: 1 };
        }
      }
    }
    
    const total = Object.values(results).reduce(
      (acc, r) => ({
        checked: acc.checked + r.checked,
        remindersSent: acc.remindersSent + r.remindersSent,
        errors: acc.errors + r.errors,
      }),
      { checked: 0, remindersSent: 0, errors: 0 }
    );
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      total,
    });
  } catch (error: any) {
    console.error('[Content Reminder API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token in Authorization header.' },
        { status: 401 }
      );
    }
    
    await requireAuth(token);
    
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    const results: Record<string, { checked: number; remindersSent: number; errors: number }> = {};
    
    if (projectId) {
      const result = await checkContentReminders(projectId as ProjectId, token);
      results[projectId] = result;
    } else {
      const projects = getAllProjects();
      for (const project of projects) {
        try {
          const result = await checkContentReminders(project.id, token);
          results[project.id] = result;
        } catch (error) {
          console.error(`[Content Reminder API] Error checking project ${project.id}:`, error);
          results[project.id] = { checked: 0, remindersSent: 0, errors: 1 };
        }
      }
    }
    
    const total = Object.values(results).reduce(
      (acc, r) => ({
        checked: acc.checked + r.checked,
        remindersSent: acc.remindersSent + r.remindersSent,
        errors: acc.errors + r.errors,
      }),
      { checked: 0, remindersSent: 0, errors: 0 }
    );
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      total,
    });
  } catch (error: any) {
    console.error('[Content Reminder API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
