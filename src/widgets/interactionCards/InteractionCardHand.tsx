import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { InteractionCardViewModel } from '~/services/interactionCards/interactionCardService';
import styles from './interactionCardHand.module.scss';

export interface InteractionCardDropInput {
  card: InteractionCardViewModel;
  pointer: {
    x: number;
    y: number;
  };
}

interface InteractionCardHandProps {
  cards: readonly InteractionCardViewModel[];
  isDisabled?: boolean;
  selectedCardId?: string | null;
  promptText?: string | null;
  onCardSelect?: (card: InteractionCardViewModel) => void;
  onCardDrop?: (input: InteractionCardDropInput) => void;
}

type CardStyle = CSSProperties & {
  '--card-x': string;
  '--card-y': string;
  '--card-rotation': string;
  '--card-order': number;
};

interface CardDragState {
  card: InteractionCardViewModel;
  pointerId: number;
  startPointer: {
    x: number;
    y: number;
  };
  currentPointer: {
    x: number;
    y: number;
  };
  hasMoved: boolean;
}

const DESKTOP_VISIBLE_CARD_COUNT = 8;
const MOBILE_VISIBLE_CARD_COUNT = 5;
const MOBILE_QUERY = '(max-width: 720px)';
const CARD_DRAG_THRESHOLD_PX = 8;

export function InteractionCardHand({
  cards,
  isDisabled = false,
  selectedCardId,
  promptText,
  onCardSelect,
  onCardDrop,
}: InteractionCardHandProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileCardLayout, setIsMobileCardLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  ));
  const [internalSelectedCardId, setInternalSelectedCardId] = useState<string | null>(null);
  const [cardDragState, setCardDragState] = useState<CardDragState | null>(null);
  const shouldSuppressClickRef = useRef(false);
  const visibleCardCount = isMobileCardLayout ? MOBILE_VISIBLE_CARD_COUNT : DESKTOP_VISIBLE_CARD_COUNT;
  const visibleCards = cards.slice(0, visibleCardCount);
  const activeSelectedCardId = selectedCardId ?? internalSelectedCardId;
  const selectedCard = cards.find(card => card.id === activeSelectedCardId) ?? null;
  const hiddenCardCount = Math.max(0, cards.length - visibleCards.length);
  const fallbackPromptText = selectedCard
    ? selectedCard.promptTemplate
      .replace('{initiator}', '__')
      .replace('{target}', '__')
    : null;
  const displayedPromptText = promptText ?? fallbackPromptText;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(MOBILE_QUERY);
    const updateLayoutMode = () => {
      setIsMobileCardLayout(mediaQueryList.matches);
    };

    updateLayoutMode();
    mediaQueryList.addEventListener('change', updateLayoutMode);

    return () => {
      mediaQueryList.removeEventListener('change', updateLayoutMode);
    };
  }, []);

  const toggleHand = () => {
    if (isDisabled || cards.length === 0) {
      return;
    }

    setIsOpen(current => !current);
  };

  const selectCard = (card: InteractionCardViewModel) => {
    setInternalSelectedCardId(card.id);
    onCardSelect?.(card);
  };

  const startCardDrag = (
    card: InteractionCardViewModel,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isOpen || isDisabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setCardDragState({
      card,
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      currentPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      hasMoved: false,
    });
  };

  const moveCardDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setCardDragState(currentState => {
      if (!currentState || currentState.pointerId !== event.pointerId) {
        return currentState;
      }

      const distance = Math.hypot(
        event.clientX - currentState.startPointer.x,
        event.clientY - currentState.startPointer.y,
      );

      return {
        ...currentState,
        currentPointer: {
          x: event.clientX,
          y: event.clientY,
        },
        hasMoved: currentState.hasMoved || distance >= CARD_DRAG_THRESHOLD_PX,
      };
    });
  };

  const finishCardDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const currentDragState = cardDragState;

    if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const dragDistance = Math.hypot(
      event.clientX - currentDragState.startPointer.x,
      event.clientY - currentDragState.startPointer.y,
    );
    const didMoveCard = currentDragState.hasMoved || dragDistance >= CARD_DRAG_THRESHOLD_PX;

    setCardDragState(null);
    selectCard(currentDragState.card);

    if (!didMoveCard) {
      return;
    }

    shouldSuppressClickRef.current = true;
    onCardDrop?.({
      card: currentDragState.card,
      pointer: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  return (
    <>
      <button
        className={styles.toggleButton}
        type="button"
        disabled={isDisabled || cards.length === 0}
        aria-expanded={isOpen}
        onClick={toggleHand}
      >
        手牌
        {cards.length > 0 ? (
          <span>{cards.length}</span>
        ) : null}
      </button>
      <section
        className={`${styles.handDock} ${isOpen ? styles.handDockOpen : ''}`}
        aria-label="互動卡片手牌"
      >
        <div className={styles.handPanel} aria-hidden={!isOpen}>
          {displayedPromptText ? (
            <div className={styles.promptPreview}>
              {displayedPromptText}
            </div>
          ) : null}
          <div className={styles.cardFan}>
            {visibleCards.map((card, index) => (
              <button
                key={card.id}
                className={`${styles.card} ${activeSelectedCardId === card.id ? styles.cardSelected : ''}`}
                type="button"
                disabled={!isOpen}
                style={createCardStyle(index, visibleCards.length, isMobileCardLayout)}
                aria-pressed={activeSelectedCardId === card.id}
                onPointerDown={event => startCardDrag(card, event)}
                onPointerMove={moveCardDrag}
                onPointerUp={finishCardDrag}
                onPointerCancel={finishCardDrag}
                onClick={() => {
                  if (shouldSuppressClickRef.current) {
                    shouldSuppressClickRef.current = false;
                    return;
                  }

                  selectCard(card);
                }}
              >
                <span className={styles.cardLabel}>{card.label}</span>
              </button>
            ))}
            {hiddenCardCount > 0 ? (
              <div className={styles.hiddenCount}>+{hiddenCardCount}</div>
            ) : null}
          </div>
        </div>
      </section>
      {cardDragState?.hasMoved ? (
        <div
          className={styles.dragPreview}
          style={{
            transform: `translate(${cardDragState.currentPointer.x + 12}px, ${cardDragState.currentPointer.y + 12}px)`,
          }}
        >
          {cardDragState.card.label}
        </div>
      ) : null}
    </>
  );
}

function createCardStyle(
  index: number,
  cardCount: number,
  isMobileCardLayout: boolean,
): CardStyle {
  const centerIndex = (cardCount - 1) / 2;
  const offsetFromCenter = index - centerIndex;
  const spacingPx = isMobileCardLayout ? 46 : 54;
  const liftPx = Math.abs(offsetFromCenter) * (isMobileCardLayout ? 3 : 4);
  const rotationDeg = offsetFromCenter * (isMobileCardLayout ? 8 : 7);

  return {
    '--card-x': `${offsetFromCenter * spacingPx}px`,
    '--card-y': `${liftPx}px`,
    '--card-rotation': `${rotationDeg}deg`,
    '--card-order': index,
  };
}
