import { ProjectId, getProject } from './projects';
import type { ProjectConfig } from './projects';

/**
 * Restrict which projects a user can access. If a user's email is listed here, they only see these projects.
 * Users not in this map have access to all projects.
 */
export const USER_PROJECT_ACCESS: Record<string, ProjectId[]> = {
  'vishwa@spellingbee.ae': ['prepcenter-oman', 'prepcenter-uae'],
};

/**
 * Team member email addresses for each project
 * prepcenter-uae, prepcenter-oman, and hive-learner have team members configured for assignment
 */
export const TEAM_MEMBERS: Record<ProjectId, string[]> = {
  'prepcenter-uae': [
    'vinitaprasad2011@gmail.com',
    'team@hivespelling.com',
    'arastogi@hivespelling.com',
    'erastogi@hivespelling.com',
    'vishwa@spellingbee.ae',
  ],
  'prepcenter-oman': [
    'vinitaprasad2011@gmail.com',
    'team@hivespelling.com',
    'arastogi@hivespelling.com',
    'erastogi@hivespelling.com',
    'vishwa@spellingbee.ae',
  ],
  'hive-learner': [
    'vinitaprasad2011@gmail.com',
    'team@hivespelling.com',
    'arastogi@hivespelling.com',
    'erastogi@hivespelling.com',
  ],
};

/**
 * Get team members for a specific project
 * @param projectId The project ID
 * @returns Array of team member email addresses
 */
export function getTeamMembers(projectId: ProjectId): string[] {
  return TEAM_MEMBERS[projectId] || [];
}

/**
 * Check if a project supports user assignment
 * prepcenter-uae, prepcenter-oman, and hive-learner support assignment
 */
export function supportsAssignment(projectId: ProjectId): boolean {
  return projectId === 'prepcenter-uae' || projectId === 'prepcenter-oman' || projectId === 'hive-learner';
}

/**
 * Get project IDs the user is allowed to access. If not in USER_PROJECT_ACCESS, all projects are allowed.
 */
export function getAllowedProjectIds(email: string | null | undefined): ProjectId[] {
  if (!email) return [];
  const allowed = USER_PROJECT_ACCESS[email.toLowerCase()];
  if (allowed) return allowed;
  return ['hive-learner', 'prepcenter-oman', 'prepcenter-uae'];
}

/**
 * Get project configs the user is allowed to access. Use for project list and switcher.
 */
export function getAllowedProjectsForUser(email: string | null | undefined): ProjectConfig[] {
  const ids = getAllowedProjectIds(email);
  return ids.map((id) => getProject(id)).filter((p): p is ProjectConfig => p != null);
}

/**
 * Check if the user has access to the given project.
 */
export function canAccessProject(email: string | null | undefined, projectId: ProjectId): boolean {
  const allowed = getAllowedProjectIds(email);
  return allowed.includes(projectId);
}
