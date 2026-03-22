export type PlayMode = 'study' | 'adventure';
export type AdventureStageKey = 'mobA' | 'mobB' | 'mobC' | 'boss' | 'secret';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ThemePartyMember {
    id: string;
    characterLabel: string;
    jobName: string;
    initialWeaponName: string;
}

export interface ThemeEnemySet {
    mobA: string;
    mobB: string;
    mobC: string;
    boss: string;
    secret: string;
}

export interface ThemeRewardSet {
    materialName: string;
    treasureName: string;
}

export interface DungeonThemeDefinition {
    id: string;
    name: string;
    description: string;
    accentText: string;
    iconName?: string;
    backgroundName?: string;
    enemies: ThemeEnemySet;
    rewards: ThemeRewardSet;
}

export interface AdventureThemeDefinition {
    id: string;
    title: string;
    introText: string;
    badgeLabels: Record<BadgeTier, string>;
    masteryLabel: string;
    partyMembers: ThemePartyMember[];
    dungeons: DungeonThemeDefinition[];
}

export interface AdventureDungeonPreview {
    badgeText: string;
    questionLevel: number;
    attackPower: number;
    recommendedPower: number;
    rewardMaterialCount: number;
    enemyHpMap: Record<AdventureStageKey, number>;
}
