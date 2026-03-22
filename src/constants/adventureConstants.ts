import type {
    AdventureStageKey,
    BadgeTier,
} from '../types/adventureTypes';

export const ADVENTURE_TIME_LIMIT_SEC = 60;
export const ADVENTURE_SECRET_UNLOCK_SECONDS = 30;
export const ADVENTURE_WEAPON_MATERIAL_REQUIREMENT = 5;
export const ADVENTURE_COMPLETE_PARTY_REWARD_COUNT = 4;

export const ADVENTURE_FEEDBACK_DELAY_MS = {
    correct: 1150,
    wrong: 1500,
    timeout: 1500,
};

export const ADVENTURE_STAGE_ORDER: AdventureStageKey[] = [
    'mobA',
    'mobB',
    'mobC',
    'boss',
    'secret',
];

export const ADVENTURE_STAGE_HP_MULTIPLIERS: Record<AdventureStageKey, number> = {
    mobA: 2,
    mobB: 3,
    mobC: 4,
    boss: 9,
    secret: 13,
};

export const ADVENTURE_BADGE_TIER_BY_COURSE_COUNT: Record<number, BadgeTier> = {
    1: 'bronze',
    2: 'silver',
    3: 'gold',
    4: 'platinum',
};

export const ADVENTURE_ATTACK_TUNING = {
    baseAttack: 34,
    perQuestionLevelRate: 0.55,
    perCourseRate: 0.08,
    perExtensionRate: 0.05,
};

export const ADVENTURE_ENEMY_TUNING = {
    baseHp: 15,
    perQuestionLevelRate: 0.42,
    perDungeonRate: 0.18,
};

export const ADVENTURE_REWARD_TUNING = {
    baseMaterials: 1,
    perQuestionLevelRate: 0.3,
    perDungeonRate: 0.35,
};
