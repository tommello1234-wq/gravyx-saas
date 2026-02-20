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
