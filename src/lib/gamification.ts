export interface MissionDef {
  day: number;
  rewardCredits: number;
  badgeId?: string;
}

export const MISSIONS: MissionDef[] = [
  { day: 1, rewardCredits: 5 },
  { day: 2, rewardCredits: 5 },
  { day: 3, rewardCredits: 5 },
  { day: 4, rewardCredits: 0, badgeId: 'gravity_explorer' },
  { day: 5, rewardCredits: 10 },
  { day: 6, rewardCredits: 10 },
  { day: 7, rewardCredits: 15, badgeId: '7day_challenger' },
  { day: 8, rewardCredits: 0, badgeId: 'flow_builder' },
  { day: 9, rewardCredits: 20 },
  { day: 10, rewardCredits: 0, badgeId: 'journey_complete' },
];

export type UserLevel = 'beginner' | 'creator' | 'strategist' | 'orchestrator' | 'architect';

export interface LevelDef {
  id: UserLevel;
  minGenerations: number;
  minProjects: number;
  extraRequirement?: string; // 'gravity' | 'streak30'
}

export const LEVELS: LevelDef[] = [
  { id: 'beginner', minGenerations: 1, minProjects: 1 },
  { id: 'creator', minGenerations: 25, minProjects: 2 },
  { id: 'strategist', minGenerations: 100, minProjects: 5, extraRequirement: 'gravity' },
  { id: 'orchestrator', minGenerations: 500, minProjects: 10 },
  { id: 'architect', minGenerations: 1000, minProjects: 15, extraRequirement: 'streak30' },
];

export const LEVEL_COLORS: Record<UserLevel, string> = {
  beginner: 'text-green-400',
  creator: 'text-blue-400',
  strategist: 'text-purple-400',
  orchestrator: 'text-yellow-400',
  architect: 'text-orange-400',
};

export const LEVEL_BG: Record<UserLevel, string> = {
  beginner: 'bg-green-400/10',
  creator: 'bg-blue-400/10',
  strategist: 'bg-purple-400/10',
  orchestrator: 'bg-yellow-400/10',
  architect: 'bg-orange-400/10',
};

export interface BadgeDef {
  id: string;
  icon: string; // emoji
}

export const BADGES: BadgeDef[] = [
  { id: 'gravity_explorer', icon: '🌌' },
  { id: 'flow_builder', icon: '🔗' },
  { id: '7day_challenger', icon: '🏆' },
  { id: 'journey_complete', icon: '🎓' },
  { id: 'architect', icon: '🔥' },
];

export function calculateLevel(
  generations: number,
  projects: number,
  usedGravity: boolean,
  longestStreak: number,
): UserLevel {
  if (generations >= 1000 && projects >= 15 && longestStreak >= 30) return 'architect';
  if (generations >= 500 && projects >= 10) return 'orchestrator';
  if (generations >= 100 && projects >= 5 && usedGravity) return 'strategist';
  if (generations >= 25 && projects >= 2) return 'creator';
  return 'beginner';
}

export function getNextLevel(current: UserLevel): LevelDef | null {
  const idx = LEVELS.findIndex(l => l.id === current);
  if (idx < LEVELS.length - 1) return LEVELS[idx + 1];
  return null;
}

export function getLevelProgress(
  current: UserLevel,
  generations: number,
  projects: number,
): number {
  const next = getNextLevel(current);
  if (!next) return 100;
  const genProg = Math.min(generations / next.minGenerations, 1);
  const projProg = Math.min(projects / next.minProjects, 1);
  return Math.round(((genProg + projProg) / 2) * 100);
}

// ---- Mission completion verification (client-side mirror of claim-reward edge function) ----

export interface MissionCheckData {
  totalGenerations: number;
  projectCount: number;
  projects: Array<{
    id: string;
    canvas_state: any;
    created_at: string;
    updated_at: string;
  }>;
  generationsByProject: Record<string, number>; // projectId -> count of completed generations
  journeyStartDate: string | null;
}

export function checkMissionCompletion(day: number, data: MissionCheckData): boolean {
  switch (day) {
    case 1:
      return data.totalGenerations >= 1;
    case 2:
      return data.projectCount >= 2;
    case 3:
      return data.projectCount >= 1;
    case 4:
      return data.projects.some(p => {
        const cs = p.canvas_state;
        return cs?.nodes?.some((n: any) => n.type === 'gravity');
      });
    case 5:
      return data.projects.some(p => {
        const cs = p.canvas_state;
        const resultNodes = (cs?.nodes ?? []).filter((n: any) => n.type === 'result');
        return resultNodes.length >= 2;
      });
    case 6:
      return data.projects.some(p => {
        const created = new Date(p.created_at).getTime();
        const updated = new Date(p.updated_at).getTime();
        return (updated - created) > 60000;
      });
    case 7:
      return data.projects.some(p => {
        const cs = p.canvas_state;
        const types = new Set((cs?.nodes ?? []).map((n: any) => n.type));
        return types.has('prompt') && types.has('media') && types.has('result');
      });
    case 8:
      return data.projects.some(p => {
        const cs = p.canvas_state;
        const resultNodes = (cs?.nodes ?? []).filter((n: any) => n.type === 'result');
        if (resultNodes.length < 2) return false;
        const resultIds = new Set(resultNodes.map((n: any) => n.id));
        return (cs?.edges ?? []).some((e: any) => resultIds.has(e.target) || resultIds.has(e.source));
      });
    case 9:
      return Object.values(data.generationsByProject).some(count => count >= 2);
    case 10: {
      if (!data.journeyStartDate) return false;
      const start = new Date(data.journeyStartDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays >= 10;
    }
    default:
      return false;
  }
}
