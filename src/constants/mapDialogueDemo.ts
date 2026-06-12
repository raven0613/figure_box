import { CHARACTER_SEEDS } from '~/constants/character';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';

const demoSeeds = CHARACTER_SEEDS.slice(0, 3);

export const MAP_DIALOGUE_FADE_DEMO: EventDialoguePresentation = {
  mode: 'preview',
  activity: {
    id: 'demo-map-preview-activity',
    participantIds: [demoSeeds[0].id, demoSeeds[1].id],
    label: '練習菜單討論中',
    previewLine: {
      characterId: demoSeeds[0].id,
      text: '先從暖身開始。',
      expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
    },
  },
  bubbleSequence: {
    id: 'demo-map-preview-bubbles',
    animation: 'fade',
    intervalMs: 1800,
    bubbleDurationMs: 1600,
    lines: [
      {
        characterId: demoSeeds[0].id,
        text: '先從暖身開始。',
        expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
      },
      {
        characterId: demoSeeds[1].id,
        text: '你果然很認真呢。',
        expressionPresetId: 'laugh',
      },
    ],
  },
};

export const MAP_DIALOGUE_BOUNCE_DEMO: EventDialoguePresentation = {
  mode: 'ambient',
  activity: {
    id: 'demo-map-ambient-activity',
    participantIds: [demoSeeds[1].id, demoSeeds[2].id],
    label: '旁邊正在嘰哩呱啦',
    previewLine: {
      characterId: demoSeeds[2].id,
      text: '我也要加入！',
      expressionPresetId: 'laugh',
    },
  },
  bubbleSequence: {
    id: 'demo-map-ambient-bubbles',
    animation: 'bounceAway',
    intervalMs: 900,
    bubbleDurationMs: 1200,
    lines: [
      {
        characterId: demoSeeds[2].id,
        text: '我也要加入！',
        expressionPresetId: 'laugh',
      },
      {
        characterId: demoSeeds[1].id,
        text: '等一下，球拍只有兩支。',
        expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
      },
      {
        characterId: demoSeeds[2].id,
        text: '那我負責加油！',
        expressionPresetId: 'laugh',
      },
    ],
  },
};
