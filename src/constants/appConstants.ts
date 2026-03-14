export const MAX_TERMS = 9;
export const TOP_RANKING_COUNT = 10;
export const REAL_DIVISION_DECIMAL_DIGITS = 2;

export const FEEDBACK_DELAY_MS = {
    correct: 650,
    wrong: 1400,
    timeout: 1400,
};

export const STORAGE_KEYS = {
    users: 'calcWarmup.users',
    selectedUserId: 'calcWarmup.selectedUserId',
    settingsByUserId: 'calcWarmup.settingsByUserId',
    ranking: 'calcWarmup.ranking.v2',
    latestResult: 'calcWarmup.latestResult.v2',
} as const;