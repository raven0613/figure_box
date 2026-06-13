import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AvatarEditorContainer } from '~/components/avatarEditor/AvatarEditorContainer';
import { DraggableFlowPanel } from '~/components/common/DraggableFlowPanel';
import {
  CHARACTER_PERSONALITY_TRAITS,
  createDefaultCharacterPersonality,
  type CharacterPersonality,
  type CharacterPersonalityTraitDefinition,
  type CharacterPersonalityTraitKey,
  type PersonalityLevel,
} from '~/constants/characterPersonality';
import {
  createPlayerCharacter,
  type CreatePlayerCharacterResult,
} from '~/services/characterCreationService';
import {
  getCharacterRoster,
  type CharacterRosterEntry,
} from '~/services/characterRosterService';
import {
  resolveTownSpriteAvatarState,
  type TownSpritePreloadCharacter,
} from '~/services/townSpritePreloadService';
import type { AvatarState } from '~/widgets/avatarCanvas';
import { bakeMiniFrontIdleSpriteSheet } from '~/widgets/miniAvatar/miniSpriteBaker';
import type { MiniSpriteSheet } from '~/widgets/miniAvatar/miniAvatarTypes';
import styles from './characterManagementPanel.module.scss';

type CharacterPanelStep = 'roster' | 'createAppearance' | 'createProfile';

const CHARACTER_MINI_SPRITE_BOX_SIZE = 56;
const CHARACTER_MINI_SPRITE_PADDING = 4;
const OPAQUE_PIXEL_ALPHA_THRESHOLD = 8;
const rosterMiniSpriteSheetCache = new Map<string, Promise<MiniSpriteSheet>>();

interface SpriteContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CharacterMiniSpritePreview {
  spriteSheet: MiniSpriteSheet;
  contentBounds: SpriteContentBounds;
}

interface CharacterCreationDraft {
  name: string;
  personality: CharacterPersonality;
}

interface CharacterManagementPanelProps {
  onClose: () => void;
  onCharacterCreated?: (result: CreatePlayerCharacterResult) => void;
  onTrackCharacter?: (characterId: string) => void;
}

export function CharacterManagementPanel({
  onClose,
  onCharacterCreated,
  onTrackCharacter,
}: CharacterManagementPanelProps) {
  const [step, setStep] = useState<CharacterPanelStep>('roster');
  const [characters, setCharacters] = useState<readonly CharacterRosterEntry[]>(() => getCharacterRoster());
  const [avatarState, setAvatarState] = useState<AvatarState | null>(null);
  const [creationDraft, setCreationDraft] = useState<CharacterCreationDraft>(createInitialCharacterCreationDraft);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const isRosterStep = step === 'roster';
  const isCreationStep = step === 'createAppearance' || step === 'createProfile';

  async function handleCreateCharacter(): Promise<void> {
    if (!avatarState) {
      setCreationError('外觀尚未準備完成，請稍候再試。');
      return;
    }

    setIsCreatingCharacter(true);
    setCreationError(null);

    try {
      const creationResult = await createPlayerCharacter({
        name: creationDraft.name,
        personality: creationDraft.personality,
        avatarState,
      });
      onCharacterCreated?.(creationResult);

      if (!onCharacterCreated) {
        setCharacters(getCharacterRoster());
        setCreationDraft(createInitialCharacterCreationDraft());
        setAvatarState(null);
        setStep('roster');
      }
    } catch (error) {
      console.error('Failed to create character:', error);
      setCreationError(error instanceof Error ? error.message : '創建角色失敗，請再試一次。');
    } finally {
      setIsCreatingCharacter(false);
    }
  }

  return (
    <DraggableFlowPanel
      title={isRosterStep ? '角色' : '創建角色'}
      initialPosition={{ left: 16, top: 72 }}
      closeAriaLabel="關閉角色面板"
      canGoBack={!isRosterStep}
      className={`${styles.panel} ${isCreationStep ? styles.creationPanel : ''}`}
      contentClassName={`${styles.panelContent} ${isCreationStep ? styles.creationPanelContent : ''}`}
      onBack={() => {
        setCreationError(null);
        setStep(step === 'createProfile' ? 'createAppearance' : 'roster');
      }}
      onClose={onClose}
    >
      {isRosterStep ? (
        <CharacterRosterView
          characters={characters}
          onTrackCharacter={onTrackCharacter}
          onCreateCharacter={() => {
            setCreationError(null);
            setStep('createAppearance');
          }}
        />
      ) : step === 'createAppearance' ? (
        <CharacterAppearanceStep
          avatarState={avatarState}
          onAvatarChange={nextAvatarState => {
            setAvatarState(nextAvatarState);
            setCreationError(null);
          }}
          onNext={() => {
            setCreationError(null);
            setStep('createProfile');
          }}
        />
      ) : (
        <CharacterProfileStep
          draft={creationDraft}
          isCreating={isCreatingCharacter}
          error={creationError}
          onBack={() => {
            setCreationError(null);
            setStep('createAppearance');
          }}
          onNameChange={name => {
            setCreationError(null);
            setCreationDraft(currentDraft => ({
              ...currentDraft,
              name,
            }));
          }}
          onPersonalityChange={(traitKey, level) => {
            setCreationError(null);
            setCreationDraft(currentDraft => ({
              ...currentDraft,
              personality: {
                ...currentDraft.personality,
                [traitKey]: level,
              },
            }));
          }}
          onFinish={handleCreateCharacter}
        />
      )}
    </DraggableFlowPanel>
  );
}

interface CharacterRosterViewProps {
  characters: readonly CharacterRosterEntry[];
  onTrackCharacter?: (characterId: string) => void;
  onCreateCharacter: () => void;
}

function CharacterRosterView({
  characters,
  onTrackCharacter,
  onCreateCharacter,
}: CharacterRosterViewProps) {
  return (
    <div className={styles.rosterView}>
      <div className={styles.rosterHeader}>
        <span>所有角色</span>
        <strong>{characters.length}</strong>
      </div>

      <div className={styles.characterList}>
        {characters.map(character => (
          <CharacterRosterRow
            key={character.id}
            character={character}
            onTrackCharacter={onTrackCharacter}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.createButton}
          type="button"
          onClick={onCreateCharacter}
        >
          創建角色
        </button>
      </div>
    </div>
  );
}

interface CharacterRosterRowProps {
  character: CharacterRosterEntry;
  onTrackCharacter?: (characterId: string) => void;
}

function CharacterRosterRow({
  character,
  onTrackCharacter,
}: CharacterRosterRowProps) {
  return (
    <div className={styles.characterRow}>
      <div className={styles.characterIdentity}>
        <CharacterMiniSprite
          character={character}
          onTrackCharacter={onTrackCharacter}
        />
        <div className={styles.characterText}>
          <strong>{character.name}</strong>
          <span>{getCharacterSourceLabel(character.source)}</span>
        </div>
      </div>
      {character.housing ? (
        <span className={styles.roomNumber}>{character.housing.roomNumber} 號房</span>
      ) : null}
    </div>
  );
}

interface CharacterMiniSpriteProps {
  character: CharacterRosterEntry;
  onTrackCharacter?: (characterId: string) => void;
}

function CharacterMiniSprite({
  character,
  onTrackCharacter,
}: CharacterMiniSpriteProps) {
  const [spritePreview, setSpritePreview] = useState<CharacterMiniSpritePreview | null>(null);
  const preloadCharacter = useMemo<TownSpritePreloadCharacter>(() => ({
    id: character.id,
    name: character.name,
    color: character.color,
  }), [character.color, character.id, character.name]);
  const frameStyle = useMemo<CSSProperties | undefined>(() => {
    if (!spritePreview) {
      return undefined;
    }

    const { spriteSheet, contentBounds } = spritePreview;
    const availableSize = CHARACTER_MINI_SPRITE_BOX_SIZE - CHARACTER_MINI_SPRITE_PADDING * 2;
    const scale = availableSize / Math.max(contentBounds.width, contentBounds.height);
    const displayWidth = spriteSheet.frameWidth * scale;
    const displayHeight = spriteSheet.frameHeight * scale;
    const contentCenterX = (contentBounds.left + contentBounds.width / 2) * scale;
    const contentCenterY = (contentBounds.top + contentBounds.height / 2) * scale;

    return {
      left: CHARACTER_MINI_SPRITE_BOX_SIZE / 2 - contentCenterX,
      top: CHARACTER_MINI_SPRITE_BOX_SIZE / 2 - contentCenterY,
      width: displayWidth,
      height: displayHeight,
      backgroundImage: `url(${spriteSheet.dataUrl})`,
      backgroundPosition: '0 0',
      backgroundSize: `${spriteSheet.sheetWidth * scale}px ${spriteSheet.sheetHeight * scale}px`,
    };
  }, [spritePreview]);

  useEffect(() => {
    let isMounted = true;

    void bakeRosterMiniSpriteSheet(preloadCharacter)
      .then(async nextSpriteSheet => ({
        spriteSheet: nextSpriteSheet,
        contentBounds: await readFirstFrameContentBounds(nextSpriteSheet),
      }))
      .then(nextSpritePreview => {
        if (isMounted) {
          setSpritePreview(nextSpritePreview);
        }
      })
      .catch(error => {
        console.error('Failed to bake character roster mini sprite:', error);

        if (isMounted) {
          setSpritePreview(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [preloadCharacter]);

  return (
    <button
      className={styles.characterMiniSprite}
      type="button"
      aria-label={`在地圖上追蹤${character.name}`}
      onClick={() => onTrackCharacter?.(character.id)}
    >
      {frameStyle ? (
        <span
          className={styles.characterMiniSpriteFrame}
          style={frameStyle}
        />
      ) : (
        <span className={styles.characterMiniSpriteFallback}>
          {getCharacterInitial(character.name)}
        </span>
      )}
    </button>
  );
}

function bakeRosterMiniSpriteSheet(
  character: TownSpritePreloadCharacter,
): Promise<MiniSpriteSheet> {
  const cacheKey = `${character.id}:${character.name}:${character.color}`;
  const cachedSpriteSheet = rosterMiniSpriteSheetCache.get(cacheKey);

  if (cachedSpriteSheet) {
    return cachedSpriteSheet;
  }

  const spriteSheetPromise = bakeMiniFrontIdleSpriteSheet(
    resolveTownSpriteAvatarState(character),
  ).catch(error => {
    rosterMiniSpriteSheetCache.delete(cacheKey);
    throw error;
  });

  rosterMiniSpriteSheetCache.set(cacheKey, spriteSheetPromise);
  return spriteSheetPromise;
}

async function readFirstFrameContentBounds(spriteSheet: MiniSpriteSheet): Promise<SpriteContentBounds> {
  const fallbackBounds = {
    left: 0,
    top: 0,
    width: spriteSheet.frameWidth,
    height: spriteSheet.frameHeight,
  };

  if (typeof document === 'undefined') {
    return fallbackBounds;
  }

  try {
    const image = await loadSpriteImage(spriteSheet.dataUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return fallbackBounds;
    }

    canvas.width = spriteSheet.frameWidth;
    canvas.height = spriteSheet.frameHeight;
    context.drawImage(
      image,
      0,
      0,
      spriteSheet.frameWidth,
      spriteSheet.frameHeight,
      0,
      0,
      spriteSheet.frameWidth,
      spriteSheet.frameHeight,
    );

    return getOpaquePixelBounds(
      context.getImageData(0, 0, spriteSheet.frameWidth, spriteSheet.frameHeight),
      fallbackBounds,
    );
  } catch (error) {
    console.error('Failed to read character roster mini sprite bounds:', error);
    return fallbackBounds;
  }
}

function getOpaquePixelBounds(
  imageData: ImageData,
  fallbackBounds: SpriteContentBounds,
): SpriteContentBounds {
  let minX = imageData.width;
  let minY = imageData.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];

      if (alpha <= OPAQUE_PIXEL_ALPHA_THRESHOLD) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return fallbackBounds;
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function loadSpriteImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load character roster mini sprite image.'));
    image.src = dataUrl;
  });
}

interface CharacterAppearanceStepProps {
  avatarState: AvatarState | null;
  onAvatarChange: (state: AvatarState) => void;
  onNext: () => void;
}

function CharacterAppearanceStep({
  avatarState,
  onAvatarChange,
  onNext,
}: CharacterAppearanceStepProps) {
  return (
    <div className={styles.appearanceStep}>
      <div className={styles.creationStepToolbar}>
        <div>
          <span className={styles.stepIndex}>1 / 2</span>
          <h3>外觀</h3>
        </div>
        <button
          className={styles.nextButton}
          type="button"
          onClick={onNext}
        >
          下一步
        </button>
      </div>
      <div className={styles.avatarEditorHost}>
        <AvatarEditorContainer
          initialState={avatarState ?? undefined}
          onAvatarChange={onAvatarChange}
        />
      </div>
    </div>
  );
}

interface CharacterProfileStepProps {
  draft: CharacterCreationDraft;
  isCreating: boolean;
  error: string | null;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onPersonalityChange: (traitKey: CharacterPersonalityTraitKey, level: PersonalityLevel) => void;
  onFinish: () => void;
}

function CharacterProfileStep({
  draft,
  isCreating,
  error,
  onBack,
  onNameChange,
  onPersonalityChange,
  onFinish,
}: CharacterProfileStepProps) {
  const canFinish = draft.name.trim().length > 0;

  return (
    <div className={styles.profileStep}>
      <div className={styles.profileFormHeader}>
        <div>
          <span className={styles.stepIndex}>2 / 2</span>
          <h3>名字與個性</h3>
        </div>
        <div className={styles.profileActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={isCreating}
            onClick={onBack}
          >
            回外觀
          </button>
          <button
            className={styles.finishButton}
            type="button"
            disabled={!canFinish || isCreating}
            onClick={onFinish}
          >
            {isCreating ? '建立中...' : '完成'}
          </button>
        </div>
      </div>

      <div className={styles.profileForm}>
        <div className={styles.profileBasics}>
          <label className={styles.nameField}>
            <span>名字</span>
            <input
              type="text"
              value={draft.name}
              maxLength={40}
              disabled={isCreating}
              onChange={event => onNameChange(event.target.value)}
            />
          </label>

          {error ? (
            <p className={styles.creationError} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className={styles.personalityList}>
          {CHARACTER_PERSONALITY_TRAITS.map(trait => (
            <PersonalitySlider
              key={trait.key}
              trait={trait}
              value={draft.personality[trait.key]}
              disabled={isCreating}
              onChange={level => onPersonalityChange(trait.key, level)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PersonalitySliderProps {
  trait: CharacterPersonalityTraitDefinition;
  value: PersonalityLevel;
  disabled: boolean;
  onChange: (level: PersonalityLevel) => void;
}

function PersonalitySlider({
  trait,
  value,
  disabled,
  onChange,
}: PersonalitySliderProps) {
  return (
    <section className={styles.personalityTrait}>
      <div className={styles.personalityTraitHeader}>
        <span>{trait.label}</span>
        <strong>{trait.options[value - 1]}</strong>
      </div>
      <div className={styles.personalitySliderRow}>
        <span>{trait.options[0]}</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          aria-label={trait.label}
          disabled={disabled}
          onChange={event => onChange(readPersonalityLevel(event.target.value))}
        />
        <span>{trait.options[4]}</span>
      </div>
      <div className={styles.personalityTicks} aria-hidden="true">
        {[1, 2, 3, 4, 5].map(level => (
          <span
            className={level === value ? styles.activePersonalityTick : ''}
            key={level}
          >
            {level}
          </span>
        ))}
      </div>
    </section>
  );
}

function readPersonalityLevel(value: string): PersonalityLevel {
  const numericValue = Number(value);

  switch (numericValue) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return numericValue;
    default:
      return 3;
  }
}

function createInitialCharacterCreationDraft(): CharacterCreationDraft {
  return {
    name: '',
    personality: createDefaultCharacterPersonality(),
  };
}

function getCharacterInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

function getCharacterSourceLabel(source: CharacterRosterEntry['source']): string {
  if (source === 'playerCreated') {
    return '自創角色';
  }

  if (source === 'imported') {
    return '匯入角色';
  }

  if (source === 'debug') {
    return '測試角色';
  }

  return '居民';
}
