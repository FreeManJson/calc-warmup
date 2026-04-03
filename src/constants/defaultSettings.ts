import { MAX_TERMS } from './appConstants';
import type { QuizSettings, UserProfile } from '../types/appTypes';

export function createFilledTermDigits (fillValue: number = 2): number[] {
    return Array.from({ length: MAX_TERMS }, () => {
        return fillValue;
    });
}

export function createDefaultSettings (): QuizSettings {
    return {
        selectedCourses: ['add'],
        maxTerms: 2,
        termMaxDigits: createFilledTermDigits(2),
        timeLimitEnabled: false,
        timeLimitSec: 10,
        questionCount: 10,
        allowNegative: false,
        allowDecimal: false,
        allowRemainder: false,
        allowRealDivision: false,
        presetName: '高校基礎',
        handwritingMemoEnabled: false,
        inputMethod: 'tile',
    };
}

export function createDefaultUsers (): UserProfile[] {
    return [
        { id: 'hero-1', name: '名も無き勇者' },
    ];
}
