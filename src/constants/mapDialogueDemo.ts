import { CHARACTER_SEEDS, Expression } from '~/constants/character';
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
      expression: Expression.Normal,
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
        expression: Expression.Normal,
      },
      {
        characterId: demoSeeds[1].id,
        text: '你果然很認真呢。',
        expression: Expression.Laugh,
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
      expression: Expression.Laugh,
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
        expression: Expression.Laugh,
      },
      {
        characterId: demoSeeds[1].id,
        text: '等一下，球拍只有兩支。',
        expression: Expression.Normal,
      },
      {
        characterId: demoSeeds[2].id,
        text: '那我負責加油！',
        expression: Expression.Laugh,
      },
    ],
  },
};
