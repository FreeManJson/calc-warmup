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

export function generateQuestions (settings: QuizSettings): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const safeCourses: CourseType[] = (
        settings.selectedCourses.length > 0
            ? settings.selectedCourses
            : ['add']
    );

    for (let lpIndex = 0; lpIndex < settings.questionCount; lpIndex += 1) {
        const course = pickRandomCourse(safeCourses);
        questions.push(generateSingleQuestion(course, settings, lpIndex));
    }

    return questions;
}

export function compareAnswer (
    question: GeneratedQuestion,
    inputValue: string
): { isCorrect: boolean; normalizedInput: string } {
    const trimmed = inputValue.trim();

    if (question.answerKind === 'quotientRemainder') {
        const matches = trimmed.match(/-?\d+/g);

        if ((matches == null) || (matches.length < 2) || (question.expectedParts == null)) {
            return {
                isCorrect: false,
                normalizedInput: trimmed,
            };
        }

        const quotient = Number(matches[0]);
        const remainder = Number(matches[1]);
        const normalizedInput = `${quotient} ${remainder}`;
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

function pickRandomCourse (courses: CourseType[]): CourseType {
    const index = randomInt(0, (courses.length - 1));
    return courses[index];
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

    const delta = createOperand(getDigitsForTerm(0, settings), settings.allowDecimal);
    let firstOperand = subTotal + delta;

    if ((settings.allowNegative === true) && (Math.random() < 0.45)) {
        firstOperand = subTotal - delta;
    }

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
    const divisorDigits = Math.min(getDigitsForTerm(1, settings), 3);
    const quotientDigits = Math.min(getDigitsForTerm(0, settings), 3);

    const divisor = Math.max(2, createIntegerOperand(divisorDigits));

    if (settings.allowRemainder === true) {
        const quotient = createIntegerOperand(quotientDigits);
        const remainder = randomInt(1, (divisor - 1));
        const dividend = ((divisor * quotient) + remainder);

        const difficultyInput: QuestionDifficultyInput = {
            course: 'div',
            termCount: 2,
            operatorsUsedCount: 1,
            hasMixedOperators: false,
            hasDecimalOperand: false,
            hasNegativeOperand: (dividend < 0) || (divisor < 0),
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
            inputHint: '商欄と余り欄に分けて入力',
            difficultyInput,
        };
    }

    if (settings.allowRealDivision === true) {
        const dividend = createIntegerOperand(Math.min(getDigitsForTerm(0, settings), 4));
        const rawAnswer = (dividend / divisor);
        const roundedAnswer = Number(rawAnswer.toFixed(REAL_DIVISION_DECIMAL_DIGITS));

        const difficultyInput: QuestionDifficultyInput = {
            course: 'div',
            termCount: 2,
            operatorsUsedCount: 1,
            hasMixedOperators: false,
            hasDecimalOperand: false,
            hasNegativeOperand: (dividend < 0) || (divisor < 0),
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

    let quotient = createIntegerOperand(quotientDigits);

    if ((settings.allowNegative === true) && (Math.random() < 0.35)) {
        quotient *= -1;
    }

    const dividend = (divisor * quotient);

    const difficultyInput: QuestionDifficultyInput = {
        course: 'div',
        termCount: 2,
        operatorsUsedCount: 1,
        hasMixedOperators: false,
        hasDecimalOperand: false,
        hasNegativeOperand: (dividend < 0) || (divisor < 0),
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
    const safeDigits = Math.max(1, digits);
    const actualDigits = randomInt(1, safeDigits);
    const minValue = (
        actualDigits === 1
            ? 0
            : Math.pow(10, (actualDigits - 1))
    );
    const maxValue = ((Math.pow(10, actualDigits)) - 1);
    const integerPart = randomInt(minValue, maxValue);

    if (allowDecimal === false) {
        return integerPart;
    }

    const decimalPart = (randomInt(0, 9) / 10);
    return Number((integerPart + decimalPart).toFixed(1));
}

function createIntegerOperand (digits: number): number {
    return Math.round(createOperand(digits, false));
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