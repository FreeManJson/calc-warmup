import type { FeedbackKindType } from '../utils/answerInputUtils';

interface QuestionStackBoardProps {
    variant: 'study' | 'adventure';
    expressions: string[];
    animationKind: FeedbackKindType;
}

const PLACEHOLDER_TEXT = '...';

export function QuestionStackBoard (
    {
        variant,
        expressions,
        animationKind,
    }: QuestionStackBoardProps
) {
    const visibleExpressions = [...expressions];

    while (visibleExpressions.length < 3) {
        visibleExpressions.push(PLACEHOLDER_TEXT);
    }

    return (
        <div className={`question-stack-board question-stack-board-${variant} question-stack-anim-${animationKind ?? 'idle'}`}>
            <div className="question-stack-hero-layer">
                {variant === 'adventure' ? <DrillHero /> : <StudyMarker />}
            </div>

            <div className="question-stack-blocks">
                {visibleExpressions.slice(0, 3).map((expression, index) => {
                    const isCurrent = (index === 0);
                    const isPlaceholder = (expression === PLACEHOLDER_TEXT);

                    return (
                        <article
                            key={`${expression}-${index}`}
                            className={[
                                'question-stack-block',
                                `question-stack-block-depth-${index}`,
                                isCurrent === true ? 'is-current' : '',
                                isPlaceholder === true ? 'is-placeholder' : '',
                            ].filter((value) => {
                                return value.length > 0;
                            }).join(' ')}
                        >
                            <div className="question-stack-block-inner">
                                <div className="question-stack-block-text">{expression}</div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

function DrillHero () {
    return (
        <div className="drill-hero" aria-hidden="true">
            <div className="drill-hero-head" />
            <div className="drill-hero-body">
                <div className="drill-hero-arm" />
                <div className="drill-hero-tool" />
            </div>
            <div className="drill-hero-legs" />
        </div>
    );
}

function StudyMarker () {
    return (
        <div className="study-marker" aria-hidden="true">
            ▼
        </div>
    );
}
