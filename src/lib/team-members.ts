import { ProjectId } from './projects';

/**
 * Team member email addresses for each project
 * Only prepcenter-uae has team members configured for assignment
 */
export const TEAM_MEMBERS: Record<ProjectId, string[]> = {
  'prepcenter-uae': [
    'vinitaprasad2011@gmail.com',
    'team@hivespelling.com',
    'arastogi@hivespelling.com',
    'erastogi@hivespelling.com',
    'vishwa@spellingbee.ae',
    'vishwababbar@gmail.com',
  ],
  'prepcenter-oman': [],
  'hive-learner': [],
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
 * Currently only prepcenter-uae supports assignment
 */
export function supportsAssignment(projectId: ProjectId): boolean {
  return projectId === 'prepcenter-uae';
}
