import { ProjectId, getProject } from './projects';

/**
 * Get Firebase Cloud Function URL for a specific project and function name
 * @param projectId The project ID
 * @param functionName The name of the Cloud Function (e.g., 'sendIssueUpdateEmail')
 * @param region The region where the function is deployed (default: 'us-central1')
 * @returns The full URL to the Cloud Function
 */
export function getFirebaseFunctionUrl(
  projectId: ProjectId,
  functionName: string,
  region: string = 'us-central1'
): string {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const firebaseProjectId = project.firebaseProjectId;
  return `https://${region}-${firebaseProjectId}.cloudfunctions.net/${functionName}`;
}
