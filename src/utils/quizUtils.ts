import {
    REAL_DIVISION_DECIMAL_DIGITS,
} from '../constants/appConstants';
import type {
    CourseType,
    GeneratedQuestion,
    QuestionDifficultyInput,
    QuizSettings,
} from '../types/appTypes';

const COURSE_LABELS: Record<CourseType, string> = {
    add: '足し算',
    sub: '引き算',
    mul: '掛け算',
    div: '割り算',
};

export interface QuestionSelectionConfig {
    courseWeights?: Partial<Record<CourseType, number>>;
    divisionWithRemainderWeight?: number;
    maxDivisionRatio?: number;
    maxRemainderDivisionRatio?: number;
}

export const LEARNING_QUESTION_SELECTION_CONFIG: QuestionSelectionConfig = {
    courseWeights: {
        add: 1,
        sub: 1,
        mul: 1,
        div: 1,
    },
};

export const ADVENTURE_QUESTION_SELECTION_CONFIG: QuestionSelectionConfig = {
    courseWeights: {
        add: 1.0,
        sub: 1.0,
        mul: 0.9,
        div: 0.7,
    },
    divisionWithRemainderWeight: 0.55,
    maxDivisionRatio: 0.25,
    maxRemainderDivisionRatio: 0.15,
};

export function getCourseLabel (course: CourseType): string {
    return COURSE_LABELS[course];
}

export function getCourseLabelText (courses: CourseType[]): string {
    if (courses.length <= 0) {
        return '未選択';
    }

    return courses.map((course) => {
        return COURSE_LABELS[course];
    }).join(' / ');
}

export function generateQuestions (
    settings: QuizSettings,
    selectionConfig: QuestionSelectionConfig = LEARNING_QUESTION_SELECTION_CONFIG
): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const courseSequence = buildQuestionCourseSequence(settings, selectionConfig);

    courseSequence.forEach((course, index) => {
        questions.push(generateSingleQuestion(course, settings, index));
    });

    return questions;
}

export function compareAnswer (
    question: GeneratedQuestion,
    inputValue: string
): { isCorrect: boolean; normalizedInput: string } {
    const trimmed = inputValue.trim();

    if (question.answerKind === 'quotientRemainder') {
        const matches = trimmed.match(/-?\d+/g);

        if ((matches == null) || (matches.length < 1) || (question.expectedParts == null)) {
            return {
                isCorrect: false,
                normalizedInput: trimmed,
            };
        }

        const quotient = Number(matches[0]);
        const remainder = Number(matches[1] ?? '0');
        const normalizedInput = `商 ${quotient} / 余り ${remainder}`;
        const isCorrect = (
            (quotient === question.expectedParts[0]) &&
            (remainder === question.expectedParts[1])
        );

        return {
            isCorrect,
            normalizedInput,
        };
    }

    const normalized = trimmed.replace(/,/g, '');
    const userNumber = Number(normalized);

    if (
        (trimmed.length <= 0) ||
        (Number.isFinite(userNumber) === false) ||
        (question.expectedNumber == null)
    ) {
        return {
            isCorrect: false,
            normalizedInput: trimmed,
        };
    }

    const tolerance = question.tolerance ?? 0.0001;
    const diff = Math.abs(userNumber - question.expectedNumber);

    return {
        isCorrect: (diff <= tolerance),
        normalizedInput: normalized,
    };
}

export function formatNumber (
    value: number,
    fractionDigits: number = 2
): string {
    if (Number.isInteger(value) === true) {
        return value.toString();
    }

    return value.toFixed(fractionDigits).replace(/\.?0+$/, '');
}

function buildQuestionCourseSequence (
    settings: QuizSettings,
    selectionConfig: QuestionSelectionConfig
): CourseType[] {
    const safeCourses: CourseType[] = (
        settings.selectedCourses.length > 0
            ? settings.selectedCourses
            : ['add']
    );
    const sequence: CourseType[] = [];
    const divisionLimit = resolveDivisionLimit(settings, selectionConfig);
    let divisionCount = 0;

    for (let lpIndex = 0; lpIndex < settings.questionCount; lpIndex += 1) {
        const selectableCourses = safeCourses.filter((course) => {
            if (course !== 'div') {
                return true;
            }

            if (divisionLimit == null) {
                return true;
            }

            return (divisionCount < divisionLimit);
        });
        const candidateCourses = (
            selectableCourses.length > 0
                ? selectableCourses
                : safeCourses
        );
        const nextCourse = pickWeightedCourse(candidateCourses, settings, selectionConfig);

        sequence.push(nextCourse);

        if (nextCourse === 'div') {
            divisionCount += 1;
        }
    }

    return sequence;
}

function resolveDivisionLimit (
    settings: QuizSettings,
    selectionConfig: QuestionSelectionConfig
): number | null {
    if (settings.selectedCourses.includes('div') === false) {
        return null;
    }

    const rawRatio = (
        settings.allowRemainder === true
            ? selectionConfig.maxRemainderDivisionRatio
            : selectionConfig.maxDivisionRatio
    );

    if ((rawRatio == null) || (rawRatio <= 0)) {
        return null;
    }

    return Math.max(1, Math.floor(settings.questionCount * rawRatio));
}

function pickWeightedCourse (
    courses: CourseType[],
    settings: QuizSettings,
    selectionConfig: QuestionSelectionConfig
): CourseType {
    const weightedCourses = courses.map((course) => {
        return {
            course,
            weight: getCourseWeight(course, settings, selectionConfig),
        };
    });
    const totalWeight = weightedCourses.reduce((sum, item) => {
        return (sum + item.weight);
    }, 0);

    if (totalWeight <= 0) {
        const index = randomInt(0, (courses.length - 1));
        return courses[index];
    }

    let roll = (Math.random() * totalWeight);

    for (let lpIndex = 0; lpIndex < weightedCourses.length; lpIndex += 1) {
        const item = weightedCourses[lpIndex];
        roll -= item.weight;

        if (roll <= 0) {
            return item.course;
        }
    }

    return weightedCourses[weightedCourses.length - 1].course;
}

function getCourseWeight (
    course: CourseType,
    settings: QuizSettings,
    selectionConfig: QuestionSelectionConfig
): number {
    if ((course === 'div') && (settings.allowRemainder === true)) {
        return Math.max(0.01, selectionConfig.divisionWithRemainderWeight ?? selectionConfig.courseWeights?.div ?? 1);
    }

    return Math.max(0.01, selectionConfig.courseWeights?.[course] ?? 1);
}

function generateSingleQuestion (
    course: CourseType,
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    switch (course) {
        case 'add':
            return generateAdditionQuestion(settings, index);

        case 'sub':
            return generateSubtractionQuestion(settings, index);

        case 'mul':
            return generateMultiplicationQuestion(settings, index);

        case 'div':
            return generateDivisionQuestion(settings, index);

        default:
            return generateAdditionQuestion(settings, index);
    }
}

function generateAdditionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const termCount = randomInt(2, settings.maxTerms);
    const operands: number[] = [];

    for (let lpIndex = 0; lpIndex < termCount; lpIndex += 1) {
        const maxDigits = getDigitsForTerm(lpIndex, settings);
        let value = createOperand(maxDigits, settings.allowDecimal);

        if ((settings.allowNegative === true) && (Math.random() < 0.25)) {
            value *= -1;
        }

        operands.push(value);
    }

    const answer = roundIfNeeded(operands.reduce((sum, value) => {
        return (sum + value);
    }, 0), settings.allowDecimal);

    const expression = operands.map((value, lpIndex) => {
        if (lpIndex === 0) {
            return wrapIfNegative(value);
        }

        if (value >= 0) {
            return `+ ${formatNumber(value, 1)}`;
        }

        return `+ (${formatNumber(value, 1)})`;
    }).join(' ');

    const difficultyInput: QuestionDifficultyInput = {
        course: 'add',
        termCount: operands.length,
        operatorsUsedCount: 1,
        hasMixedOperators: false,
        hasDecimalOperand: operands.some((value) => {
            return (Number.isInteger(value) === false);
        }),
        hasNegativeOperand: operands.some((value) => {
            return (value < 0);
        }),
        resultIsNegative: (answer < 0),
        maxDigits: Math.max(...operands.map((value) => {
            return getDisplayDigitCount(value);
        })),
        hasCarryOrBorrow: detectCarryInAddition(operands),
        hasParentheses: false,
        hasPriorityOperation: false,
        hasRemainder: false,
        hasRealDivision: false,
    };

    return {
        id: `q-add-${index}-${Date.now()}`,
        course: 'add',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficultyInput,
    };
}

function generateSubtractionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const termCount = randomInt(2, settings.maxTerms);
    const subOperands: number[] = [];

    for (let lpIndex = 1; lpIndex < termCount; lpIndex += 1) {
        const maxDigits = getDigitsForTerm(lpIndex, settings);
        subOperands.push(createOperand(maxDigits, settings.allowDecimal));
    }

    const subTotal = roundIfNeeded(subOperands.reduce((sum, value) => {
        return (sum + value);
    }, 0), settings.allowDecimal);
    const firstOperandMaxDigits = getDigitsForTerm(0, settings);
    const firstOperand = createSubtractionFirstOperand(
        firstOperandMaxDigits,
        settings.allowDecimal,
        settings.allowNegative,
        subTotal
    );
    const answer = roundIfNeeded(
        firstOperand - subTotal,
        settings.allowDecimal
    );

    const rightExpression = subOperands.map((value) => {
        return formatNumber(value, 1);
    }).join(' - ');

    const allOperands = [firstOperand, ...subOperands];

    const difficultyInput: QuestionDifficultyInput = {
        course: 'sub',
        termCount: allOperands.length,
        operatorsUsedCount: 1,
        hasMixedOperators: false,
        hasDecimalOperand: allOperands.some((value) => {
            return (Number.isInteger(value) === false);
        }),
        hasNegativeOperand: allOperands.some((value) => {
            return (value < 0);
        }),
        resultIsNegative: (answer < 0),
        maxDigits: Math.max(...allOperands.map((value) => {
            return getDisplayDigitCount(value);
        })),
        hasCarryOrBorrow: detectBorrowInSubtraction(firstOperand, subOperands),
        hasParentheses: false,
        hasPriorityOperation: false,
        hasRemainder: false,
        hasRealDivision: false,
    };

    return {
        id: `q-sub-${index}-${Date.now()}`,
        course: 'sub',
        expression: `${formatNumber(firstOperand, 1)} - ${rightExpression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficultyInput,
    };
}

function generateMultiplicationQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const effectiveTermCount = Math.min(settings.maxTerms, (settings.allowDecimal === true ? 3 : 4));
    const termCount = randomInt(2, effectiveTermCount);
    const operands: number[] = [];

    for (let lpIndex = 0; lpIndex < termCount; lpIndex += 1) {
        const rawDigits = getDigitsForTerm(lpIndex, settings);
        const maxDigits = Math.min(rawDigits, (settings.allowDecimal === true ? 2 : 3));
        let value = createOperand(maxDigits, settings.allowDecimal);

        if (
            (settings.allowNegative === true) &&
            (lpIndex === 0) &&
            (Math.random() < 0.35)
        ) {
            value *= -1;
        }

        operands.push(value);
    }

    const answer = roundIfNeeded(operands.reduce((sum, value) => {
        return (sum * value);
    }, 1), settings.allowDecimal);

    const expression = operands.map((value) => {
        return wrapIfNegative(value);
    }).join(' × ');

    const difficultyInput: QuestionDifficultyInput = {
        course: 'mul',
        termCount: operands.length,
        operatorsUsedCount: 1,
        hasMixedOperators: false,
        hasDecimalOperand: operands.some((value) => {
            return (Number.isInteger(value) === false);
        }),
        hasNegativeOperand: operands.some((value) => {
            return (value < 0);
        }),
        resultIsNegative: (answer < 0),
        maxDigits: Math.max(...operands.map((value) => {
            return getDisplayDigitCount(value);
        })),
        hasCarryOrBorrow: false,
        hasParentheses: false,
        hasPriorityOperation: false,
        hasRemainder: false,
        hasRealDivision: false,
    };

    return {
        id: `q-mul-${index}-${Date.now()}`,
        course: 'mul',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 2),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficultyInput,
    };
}

function generateDivisionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const dividendDigits = Math.max(1, getDigitsForTerm(0, settings));
    const divisorDigits = Math.max(1, getDigitsForTerm(1, settings));

    if (settings.allowRemainder === true) {
        const operands = createDivisionOperandsWithRemainder(
            dividendDigits,
            divisorDigits
        );
        const { dividend, divisor, quotient, remainder } = operands;

        const difficultyInput: QuestionDifficultyInput = {
            course: 'div',
            termCount: 2,
            operatorsUsedCount: 1,
            hasMixedOperators: false,
            hasDecimalOperand: false,
            hasNegativeOperand: false,
            resultIsNegative: false,
            maxDigits: Math.max(
                getDisplayDigitCount(dividend),
                getDisplayDigitCount(divisor)
            ),
            hasCarryOrBorrow: false,
            hasParentheses: false,
            hasPriorityOperation: false,
            hasRemainder: true,
            hasRealDivision: false,
        };

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'quotientRemainder',
            correctText: `商 ${quotient} / 余り ${remainder}`,
            expectedParts: [quotient, remainder],
            inputHint: '商を入力し、余り欄が空欄なら 0 扱いです',
            difficultyInput,
        };
    }

    if (settings.allowRealDivision === true) {
        const divisor = createIntegerOperandWithinDigits(divisorDigits, 2);
        const dividend = createIntegerOperandWithinDigits(dividendDigits, 0);
        const rawAnswer = (dividend / divisor);
        const roundedAnswer = Number(rawAnswer.toFixed(REAL_DIVISION_DECIMAL_DIGITS));

        const difficultyInput: QuestionDifficultyInput = {
            course: 'div',
            termCount: 2,
            operatorsUsedCount: 1,
            hasMixedOperators: false,
            hasDecimalOperand: false,
            hasNegativeOperand: false,
            resultIsNegative: (roundedAnswer < 0),
            maxDigits: Math.max(
                getDisplayDigitCount(dividend),
                getDisplayDigitCount(divisor)
            ),
            hasCarryOrBorrow: false,
            hasParentheses: false,
            hasPriorityOperation: false,
            hasRemainder: false,
            hasRealDivision: true,
        };

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'number',
            correctText: formatNumber(roundedAnswer, REAL_DIVISION_DECIMAL_DIGITS),
            expectedNumber: roundedAnswer,
            tolerance: 0.005,
            inputHint: `小数第${REAL_DIVISION_DECIMAL_DIGITS}位までで入力`,
            difficultyInput,
        };
    }

    const operands = createExactDivisionOperands(
        dividendDigits,
        divisorDigits
    );
    let quotient = operands.quotient;
    let dividend = operands.dividend;
    const divisor = operands.divisor;

    if ((settings.allowNegative === true) && (Math.random() < 0.35)) {
        quotient *= -1;
        dividend *= -1;
    }

    const difficultyInput: QuestionDifficultyInput = {
        course: 'div',
        termCount: 2,
        operatorsUsedCount: 1,
        hasMixedOperators: false,
        hasDecimalOperand: false,
        hasNegativeOperand: (dividend < 0),
        resultIsNegative: (quotient < 0),
        maxDigits: Math.max(
            getDisplayDigitCount(dividend),
            getDisplayDigitCount(divisor)
        ),
        hasCarryOrBorrow: false,
        hasParentheses: false,
        hasPriorityOperation: false,
        hasRemainder: false,
        hasRealDivision: false,
    };

    return {
        id: `q-div-${index}-${Date.now()}`,
        course: 'div',
        expression: `${dividend} ÷ ${divisor} = ?`,
        answerKind: 'number',
        correctText: quotient.toString(),
        expectedNumber: quotient,
        tolerance: 0.0001,
        difficultyInput,
    };
}

function getDigitsForTerm (
    termIndex: number,
    settings: QuizSettings
): number {
    return settings.termMaxDigits[termIndex] ?? settings.termMaxDigits[0] ?? 2;
}

function createOperand (
    digits: number,
    allowDecimal: boolean
): number {
    const range = buildUpToDigitRange(digits, 0);
    const integerPart = randomInt(range.min, range.max);

    if (allowDecimal === false) {
        return integerPart;
    }

    const decimalPart = (randomInt(0, 9) / 10);
    return Number((integerPart + decimalPart).toFixed(1));
}

function createSubtractionFirstOperand (
    maxDigits: number,
    allowDecimal: boolean,
    allowNegative: boolean,
    subTotal: number
): number {
    const range = buildUpToDigitRange(maxDigits, 0);
    const maxValue = range.max;
    const minValue = range.min;

    if (allowDecimal === true) {
        const minCandidateTenths = Math.max(0, Math.ceil(subTotal * 10));
        const maxCandidateTenths = ((maxValue * 10) + 9);

        if (minCandidateTenths <= maxCandidateTenths) {
            return Number((randomInt(minCandidateTenths, maxCandidateTenths) / 10).toFixed(1));
        }

        if (allowNegative === true) {
            return Number((randomInt(0, maxCandidateTenths) / 10).toFixed(1));
        }

        return Number((maxCandidateTenths / 10).toFixed(1));
    }

    const nonNegativeMinValue = Math.ceil(subTotal);

    if (nonNegativeMinValue <= maxValue) {
        return randomInt(nonNegativeMinValue, maxValue);
    }

    if (allowNegative === true) {
        return randomInt(minValue, maxValue);
    }

    return maxValue;
}

function createIntegerOperandWithinDigits (digits: number, minAllowedValue: number = 0): number {
    const safeDigits = Math.max(1, digits);
    const minValue = Math.max(minAllowedValue, 0);
    const maxValue = ((Math.pow(10, safeDigits)) - 1);

    if (minValue > maxValue) {
        return maxValue;
    }

    return randomInt(minValue, maxValue);
}

function createExactDivisionOperands (
    dividendDigits: number,
    divisorDigits: number
): { dividend: number; divisor: number; quotient: number } {
    const dividendRange = buildUpToDigitRange(dividendDigits, 1);
    const divisorRange = buildUpToDigitRange(divisorDigits, 2);
    const preferredDivisorMax = Math.max(2, Math.floor(dividendRange.max / 2));
    const effectiveDivisorMax = Math.max(2, Math.min(divisorRange.max, dividendRange.max, preferredDivisorMax));
    const effectiveDivisorMin = Math.min(divisorRange.min, effectiveDivisorMax);

    for (let attempt = 0; attempt < 240; attempt += 1) {
        const divisor = randomInt(effectiveDivisorMin, effectiveDivisorMax);
        const minQuotient = Math.max(1, Math.ceil(dividendRange.min / divisor));
        const maxQuotient = Math.floor(dividendRange.max / divisor);

        if (minQuotient > maxQuotient) {
            continue;
        }

        const preferredMinQuotient = (maxQuotient >= 2 ? Math.max(2, minQuotient) : minQuotient);
        const quotient = randomInt(preferredMinQuotient, maxQuotient);
        const dividend = (divisor * quotient);

        if ((dividend >= dividendRange.min) && (dividend <= dividendRange.max)) {
            return { dividend, divisor, quotient };
        }
    }

    const fallbackDivisor = Math.max(2, effectiveDivisorMin);
    const fallbackQuotient = Math.max(2, Math.floor(dividendRange.max / fallbackDivisor));

    return {
        divisor: fallbackDivisor,
        quotient: fallbackQuotient,
        dividend: (fallbackDivisor * fallbackQuotient),
    };
}

function createDivisionOperandsWithRemainder (
    dividendDigits: number,
    divisorDigits: number
): { dividend: number; divisor: number; quotient: number; remainder: number } {
    const dividendRange = buildUpToDigitRange(dividendDigits, 1);
    const divisorRange = buildUpToDigitRange(divisorDigits, 2);
    const preferredDivisorMax = Math.max(2, Math.floor(dividendRange.max / 2));
    const effectiveDivisorMax = Math.max(2, Math.min(divisorRange.max, dividendRange.max, preferredDivisorMax));
    const effectiveDivisorMin = Math.min(divisorRange.min, effectiveDivisorMax);

    for (let attempt = 0; attempt < 320; attempt += 1) {
        const divisor = randomInt(effectiveDivisorMin, effectiveDivisorMax);
        const maxQuotient = Math.floor((dividendRange.max - 1) / divisor);

        if (maxQuotient < 1) {
            continue;
        }

        const minQuotient = (maxQuotient >= 2 ? 2 : 1);
        const quotient = randomInt(minQuotient, maxQuotient);
        const minRemainder = Math.max(1, (dividendRange.min - (divisor * quotient)));
        const maxRemainder = Math.min((divisor - 1), (dividendRange.max - (divisor * quotient)));

        if (minRemainder > maxRemainder) {
            continue;
        }

        const remainder = randomInt(minRemainder, maxRemainder);
        const dividend = ((divisor * quotient) + remainder);

        if ((dividend >= dividendRange.min) && (dividend <= dividendRange.max)) {
            return { dividend, divisor, quotient, remainder };
        }
    }

    const fallback = createExactDivisionOperands(dividendDigits, divisorDigits);
    const safeRemainder = Math.min(Math.max(1, fallback.divisor - 1), Math.max(1, fallback.dividend - (fallback.divisor * Math.max(1, fallback.quotient - 1))));
    const fallbackDividend = Math.max(
        buildUpToDigitRange(dividendDigits, 1).min,
        Math.min(buildUpToDigitRange(dividendDigits, 1).max, ((fallback.divisor * fallback.quotient) + safeRemainder))
    );

    return {
        dividend: fallbackDividend,
        divisor: fallback.divisor,
        quotient: Math.floor(fallbackDividend / fallback.divisor),
        remainder: (fallbackDividend % fallback.divisor),
    };
}

function buildUpToDigitRange (digits: number, minAllowedValue: number): { min: number; max: number } {
    const safeDigits = Math.max(1, digits);
    const min = Math.max(minAllowedValue, 0);
    const max = ((Math.pow(10, safeDigits)) - 1);

    return {
        min: Math.min(min, max),
        max,
    };
}

function wrapIfNegative (value: number): string {
    if (value < 0) {
        return `(${formatNumber(value, 2)})`;
    }

    return formatNumber(value, 2);
}

function roundIfNeeded (
    value: number,
    allowDecimal: boolean
): number {
    if (allowDecimal === true) {
        return Number(value.toFixed(2));
    }

    return Math.round(value);
}

function randomInt (
    minValue: number,
    maxValue: number
): number {
    const min = Math.ceil(minValue);
    const max = Math.floor(maxValue);

    return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function getDisplayDigitCount (value: number): number {
    const absValue = Math.abs(value);
    const integerPart = Math.floor(absValue);

    if (integerPart >= 1) {
        return integerPart.toString().length;
    }

    return 1;
}

function detectCarryInAddition (operands: number[]): boolean {
    const canCheck = operands.every((value) => {
        return (
            (Number.isInteger(value) === true) &&
            (value >= 0)
        );
    });

    if (canCheck === false) {
        return false;
    }

    const maxDigits = Math.max(...operands.map((value) => {
        return getDisplayDigitCount(value);
    }));

    let carry = 0;

    for (let lpDigit = 0; lpDigit < maxDigits; lpDigit += 1) {
        let digitSum = carry;

        operands.forEach((value) => {
            digitSum += getDigitAt(value, lpDigit);
        });

        if (digitSum >= 10) {
            return true;
        }

        carry = Math.floor(digitSum / 10);
    }

    return false;
}

function detectBorrowInSubtraction (
    firstOperand: number,
    subOperands: number[]
): boolean {
    const allValues = [firstOperand, ...subOperands];
    const canCheck = allValues.every((value) => {
        return (
            (Number.isInteger(value) === true) &&
            (value >= 0)
        );
    });

    if (canCheck === false) {
        return false;
    }

    let currentValue = firstOperand;

    for (let lpIndex = 0; lpIndex < subOperands.length; lpIndex += 1) {
        const nextValue = subOperands[lpIndex];

        if (detectBorrowInPair(currentValue, nextValue) === true) {
            return true;
        }

        currentValue -= nextValue;
    }

    return false;
}

function detectBorrowInPair (
    minuend: number,
    subtrahend: number
): boolean {
    if (minuend < subtrahend) {
        return true;
    }

    const maxDigits = Math.max(
        getDisplayDigitCount(minuend),
        getDisplayDigitCount(subtrahend)
    );

    let borrow = 0;

    for (let lpDigit = 0; lpDigit < maxDigits; lpDigit += 1) {
        const left = (getDigitAt(minuend, lpDigit) - borrow);
        const right = getDigitAt(subtrahend, lpDigit);

        if (left < right) {
            return true;
        }

        borrow = 0;
    }

    return false;
}

function getDigitAt (
    value: number,
    digitIndex: number
): number {
    const absValue = Math.abs(Math.floor(value));
    return Math.floor(absValue / Math.pow(10, digitIndex)) % 10;
}
