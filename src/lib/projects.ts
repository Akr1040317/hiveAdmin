export type ProjectId = 'hive-learner' | 'prepcenter-oman' | 'prepcenter-uae';

export type FirebaseProjectType = 'admin' | 'prepcenter' | 'hive';

export interface ProjectConfig {
  id: ProjectId;
  displayName: string;
  accentColorKey: 'purple' | 'orange' | 'blue';
  firebaseProjectId: string; // Firebase project ID (e.g., 'prepcenter-firebase', 'hive-firebase')
  firebaseProjectType: FirebaseProjectType; // Which Firebase project this uses
  accentClasses: {
    text: string;
    bg: string;
    border: string;
    ring: string;
    hover: string;
    badge: string;
    // Secondary accent classes for UI elements
    secondary: {
      text: string;
      bg: string;
      border: string;
      hover: string;
    };
  };
}

export const PROJECTS: Record<ProjectId, ProjectConfig> = {
  'hive-learner': {
    id: 'hive-learner',
    displayName: 'Hive Learner',
    accentColorKey: 'purple',
    firebaseProjectId: process.env.HIVE_FIREBASE_PROJECT_ID || 'beeapp-5c98b',
    firebaseProjectType: 'hive',
    accentClasses: {
      text: 'text-violet-300',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30',
      ring: 'focus:ring-violet-500/40',
      hover: 'hover:bg-violet-500/10',
      badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      secondary: {
        text: 'text-accent-purple-light',
        bg: 'bg-accent-purple-subtle',
        border: 'border-accent-purple-border',
        hover: 'hover:bg-accent-purple-subtle',
      },
    },
  },
  'prepcenter-oman': {
    id: 'prepcenter-oman',
    displayName: 'PrepCenter Oman',
    accentColorKey: 'orange',
    firebaseProjectId: process.env.PREPCENTER_FIREBASE_PROJECT_ID || 'prepcenter-750c1',
    firebaseProjectType: 'prepcenter',
    accentClasses: {
      text: 'text-orange-300',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      ring: 'focus:ring-orange-500/40',
      hover: 'hover:bg-orange-500/10',
      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      secondary: {
        text: 'text-accent-pink-light',
        bg: 'bg-accent-pink-subtle',
        border: 'border-accent-pink-border',
        hover: 'hover:bg-accent-pink-subtle',
      },
    },
  },
  'prepcenter-uae': {
    id: 'prepcenter-uae',
    displayName: 'PrepCenter UAE',
    accentColorKey: 'blue',
    firebaseProjectId: process.env.PREPCENTER_FIREBASE_PROJECT_ID || 'prepcenter-750c1',
    firebaseProjectType: 'prepcenter',
    accentClasses: {
      text: 'text-blue-300',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      ring: 'focus:ring-blue-500/40',
      hover: 'hover:bg-blue-500/10',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      secondary: {
        text: 'text-accent-blue-light',
        bg: 'bg-accent-blue-subtle',
        border: 'border-accent-blue-border',
        hover: 'hover:bg-accent-blue-subtle',
      },
    },
  },
};

export function getProject(id: ProjectId): ProjectConfig | undefined {
  return PROJECTS[id];
}

export function getAllProjects(): ProjectConfig[] {
  return Object.values(PROJECTS);
}
