import {
    REAL_DIVISION_DECIMAL_DIGITS,
} from '../constants/appConstants';
import type {
    AnswerResult,
    CourseType,
    GeneratedQuestion,
    QuizResult,
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

export function calculateQuestionScore (
    question: GeneratedQuestion,
    isCorrect: boolean,
    elapsedMs: number,
    settings: QuizSettings
): number {
    let targetMs = 3500;

    targetMs += ((settings.maxTerms - 2) * 500);

    const maxDigits = Math.max(...settings.termMaxDigits.slice(0, settings.maxTerms), 1);
    targetMs += ((maxDigits - 1) * 250);

    if (settings.timeLimitEnabled === true) {
        targetMs = (settings.timeLimitSec * 1000);
    }

    if (isCorrect === false) {
        return 0;
    }

    const speedFactorBase = (targetMs / Math.max(elapsedMs, 300));
    const speedFactor = clamp(speedFactorBase, 0.6, 1.4);
    const rawScore = (100 * question.difficulty * speedFactor);

    return Math.round(rawScore);
}

export function buildQuizResult (
    userName: string,
    settings: QuizSettings,
    answers: AnswerResult[]
): QuizResult {
    const totalQuestions = answers.length;
    const correctCount = answers.filter((answer) => {
        return (answer.isCorrect === true);
    }).length;

    const totalElapsedMs = answers.reduce((sum, answer) => {
        return (sum + answer.elapsedMs);
    }, 0);

    const totalScore = answers.reduce((sum, answer) => {
        return (sum + answer.score);
    }, 0);

    const accuracyRate = (
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0
    );

    const averageAnswerMs = (
        totalQuestions > 0
            ? Math.round(totalElapsedMs / totalQuestions)
            : 0
    );

    return {
        userName,
        courseLabel: getCourseLabelText(settings.selectedCourses),
        totalQuestions,
        correctCount,
        accuracyRate,
        averageAnswerMs,
        score: totalScore,
        playedAt: formatDateTime(new Date()),
        answers,
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

    return {
        id: `q-add-${index}-${Date.now()}`,
        course: 'add',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('add', settings, termCount),
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

    return {
        id: `q-sub-${index}-${Date.now()}`,
        course: 'sub',
        expression: `${formatNumber(firstOperand, 1)} - ${rightExpression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('sub', settings, termCount),
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

    return {
        id: `q-mul-${index}-${Date.now()}`,
        course: 'mul',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 2),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('mul', settings, termCount),
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

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'quotientRemainder',
            correctText: `商 ${quotient} / 余り ${remainder}`,
            expectedParts: [quotient, remainder],
            inputHint: '商と余りを半角スペース区切りで入力（例: 12 3）',
            difficulty: calculateDifficulty('div', settings, 2),
        };
    }

    if (settings.allowRealDivision === true) {
        const dividend = createIntegerOperand(Math.min(getDigitsForTerm(0, settings), 4));
        const rawAnswer = (dividend / divisor);
        const roundedAnswer = Number(rawAnswer.toFixed(REAL_DIVISION_DECIMAL_DIGITS));

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'number',
            correctText: formatNumber(roundedAnswer, REAL_DIVISION_DECIMAL_DIGITS),
            expectedNumber: roundedAnswer,
            tolerance: 0.005,
            inputHint: `小数第${REAL_DIVISION_DECIMAL_DIGITS}位までで入力`,
            difficulty: calculateDifficulty('div', settings, 2),
        };
    }

    let quotient = createIntegerOperand(quotientDigits);

    if ((settings.allowNegative === true) && (Math.random() < 0.35)) {
        quotient *= -1;
    }

    const dividend = (divisor * quotient);

    return {
        id: `q-div-${index}-${Date.now()}`,
        course: 'div',
        expression: `${dividend} ÷ ${divisor} = ?`,
        answerKind: 'number',
        correctText: quotient.toString(),
        expectedNumber: quotient,
        tolerance: 0.0001,
        difficulty: calculateDifficulty('div', settings, 2),
    };
}

function calculateDifficulty (
    course: CourseType,
    settings: QuizSettings,
    termCount: number
): number {
    let difficulty = 1.0;

    switch (course) {
        case 'add':
            difficulty = 1.00;
            break;

        case 'sub':
            difficulty = 1.12;
            break;

        case 'mul':
            difficulty = 1.35;
            break;

        case 'div':
            difficulty = 1.55;
            break;

        default:
            difficulty = 1.00;
            break;
    }

    difficulty += ((termCount - 2) * 0.08);

    const visibleDigits = settings.termMaxDigits.slice(0, settings.maxTerms);
    const maxDigits = Math.max(...visibleDigits, 1);

    difficulty += ((maxDigits - 1) * 0.07);

    if (settings.allowNegative === true) {
        difficulty += 0.10;
    }

    if (settings.allowDecimal === true) {
        difficulty += 0.15;
    }

    if (settings.allowRealDivision === true) {
        difficulty += 0.18;
    }

    if (settings.allowRemainder === true) {
        difficulty += 0.12;
    }

    return Number(difficulty.toFixed(2));
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
    const minValue = (
        safeDigits === 1
            ? 0
            : Math.pow(10, (safeDigits - 1))
    );
    const maxValue = ((Math.pow(10, safeDigits)) - 1);
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

function clamp (
    value: number,
    minValue: number,
    maxValue: number
): number {
    return Math.min(Math.max(value, minValue), maxValue);
}

function randomInt (
    minValue: number,
    maxValue: number
): number {
    const min = Math.ceil(minValue);
    const max = Math.floor(maxValue);

    return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function formatDateTime (date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    const second = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}