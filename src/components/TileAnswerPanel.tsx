import type { AnswerKind } from '../types/appTypes';
import type { TileTargetType } from '../utils/answerInputUtils';

interface TileAnswerPanelProps {
    answerKind: AnswerKind;
    answerValue: string;
    quotientValue: string;
    remainderValue: string;
    activeTarget: TileTargetType;
    disabled: boolean;
    allowMinus: boolean;
    allowDecimal: boolean;
    submitLabel: string;
    validationMessage: string;
    onSetTarget: (target: TileTargetType) => void;
    onAppendTileValue: (value: string) => void;
    onBackspace: () => void;
    onClear: () => void;
    onAppendMinus: () => void;
    onAppendDecimal: () => void;
    onSubmit: () => void;
}

export function TileAnswerPanel (
    {
        answerKind,
        answerValue,
        quotientValue,
        remainderValue,
        activeTarget,
        disabled,
        allowMinus,
        allowDecimal,
        submitLabel,
        validationMessage,
        onSetTarget,
        onAppendTileValue,
        onBackspace,
        onClear,
        onAppendMinus,
        onAppendDecimal,
        onSubmit,
    }: TileAnswerPanelProps
) {
    const isQuotientRemainder = (answerKind === 'quotientRemainder');

    return (
        <div className="tile-answer-panel">
            <div className="tile-answer-display">
                {isQuotientRemainder === true ? (
                    <div className="tile-answer-inline" role="group" aria-label="商と余りの入力欄">
                        <button
                            type="button"
                            className={`tile-answer-slot ${(activeTarget === 'quotient') ? 'is-active' : ''}`}
                            onClick={() => {
                                onSetTarget('quotient');
                            }}
                            disabled={disabled}
                        >
                            <span className={`tile-answer-slot-value ${(quotientValue.length <= 0) ? 'is-empty' : ''}`}>
                                {quotientValue.length > 0 ? quotientValue : ' '}
                            </span>
                        </button>

                        <span className="tile-answer-separator">あまり</span>

                        <button
                            type="button"
                            className={`tile-answer-slot ${(activeTarget === 'remainder') ? 'is-active' : ''}`}
                            onClick={() => {
                                onSetTarget('remainder');
                            }}
                            disabled={disabled}
                        >
                            <span className={`tile-answer-slot-value ${(remainderValue.length <= 0) ? 'is-placeholder' : ''}`}>
                                {remainderValue.length > 0 ? remainderValue : '0'}
                            </span>
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="tile-answer-single"
                        onClick={() => {
                            onSetTarget('answer');
                        }}
                        disabled={disabled}
                    >
                        <span className={`tile-answer-slot-value ${(answerValue.length <= 0) ? 'is-empty' : ''}`}>
                            {answerValue.length > 0 ? answerValue : ' '}
                        </span>
                    </button>
                )}
            </div>

            {validationMessage.length > 0 && (
                <div className="input-error-text">{validationMessage}</div>
            )}

            <div className="keypad-grid top-gap">
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('7'); }}>7</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('8'); }}>8</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('9'); }}>9</button>
                <button type="button" className="keypad-button keypad-button-sub" disabled={disabled} onClick={onBackspace}>←</button>

                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('4'); }}>4</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('5'); }}>5</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('6'); }}>6</button>
                <button type="button" className="keypad-button keypad-button-sub" disabled={disabled} onClick={onClear}>C</button>

                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('1'); }}>1</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('2'); }}>2</button>
                <button type="button" className="keypad-button" disabled={disabled} onClick={() => { onAppendTileValue('3'); }}>3</button>
                <button type="button" className="keypad-button keypad-button-sub" disabled={disabled || (allowMinus === false)} onClick={onAppendMinus}>-</button>

                <button type="button" className="keypad-button keypad-button-wide" disabled={disabled} onClick={() => { onAppendTileValue('0'); }}>0</button>

                {isQuotientRemainder === true ? (
                    <button
                        type="button"
                        className={`keypad-button keypad-button-sub ${(activeTarget === 'remainder') ? 'is-selected' : ''}`}
                        disabled={disabled}
                        onClick={() => {
                            onSetTarget('remainder');
                        }}
                    >
                        余り
                    </button>
                ) : (
                    <button type="button" className="keypad-button keypad-button-sub" disabled={disabled || (allowDecimal === false)} onClick={onAppendDecimal}>.</button>
                )}

                <button type="button" className="keypad-button keypad-button-primary" disabled={disabled} onClick={onSubmit}>{submitLabel}</button>
            </div>
        </div>
    );
}
