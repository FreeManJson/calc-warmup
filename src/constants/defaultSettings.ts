import type { QuizSettings, UserProfile } from '../types/appTypes';

export function createDefaultSettings (): QuizSettings {
    return {
        selectedCourses: ['add'],
        maxTerms: 2,
        firstTermMaxDigits: 2,
        secondTermMaxDigits: 2,
        timeLimitEnabled: false,
        timeLimitSec: 10,
        questionCount: 10,
        allowNegative: false,
        allowDecimal: false,
        allowRemainder: false,
        allowRealDivision: false,
        presetName: '高校基礎',
        handwritingMemoEnabled: false,
    };
}

export function createDefaultUsers (): UserProfile[] {
    return [
        { id: 'father', name: 'お父さん' },
        { id: 'son', name: '息子' },
    ];
}