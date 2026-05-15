import { CHARACTER_SEEDS, Expression, type CharacterBaseSetting } from './character';

export type DialogueAvatarSlot = 'left' | 'center-left' | 'center-right' | 'right';

export interface DialogueViewParticipant {
  id: string;
  name: string;
  color: string;
  label: string;
  slot: DialogueAvatarSlot;
  avatar?: CharacterBaseSetting['avatar'];
}

export interface DialogueViewLine {
  id?: string;
  type: 'SAY';
  speakerId: string;
  text: string;
  expression: Expression;
}

export interface DialogueViewChoice {
  id: string;
  label: string;
  result: DialogueChoiceResult;
}

export type DialogueChoiceResult =
  | {
    type: 'appendLines';
    lines: DialogueViewInstruction[];
  }
  | {
    type: 'replaceRemaining';
    lines: DialogueViewInstruction[];
  }
  | {
    type: 'jumpTo';
    target: DialogueJumpTarget;
  }
  | {
    type: 'branch';
    branchGroupId: string;
  }
  | {
    type: 'end';
  };

export type DialogueJumpTarget =
  | {
    type: 'index';
    index: number;
  }
  | {
    type: 'anchor';
    anchorId: string;
  };

export interface DialogueDemoCharacterState {
  id: string;
  traits: string[];
}

export interface DialogueDemoRelationshipState {
  sourceId: string;
  targetId: string;
  intimacy: number;
}

export interface DialogueBranchContext {
  characters: DialogueDemoCharacterState[];
  relationships: DialogueDemoRelationshipState[];
  recentBranchIds?: string[];
  random?: () => number;
}

export type DialogueCondition =
  | {
    type: 'intimacyRange';
    sourceId: string;
    targetId: string;
    min?: number;
    max?: number;
  }
  | {
    type: 'traitIncludes';
    characterId: string;
    trait: string;
  };

export interface DialogueScoreRule {
  when: DialogueCondition;
  add: number;
  multiplier?: number;
}

export interface DialogueBranchCandidate {
  id: string;
  selectionMode: 'required' | 'weighted';
  priority?: number;
  baseWeight: number;
  conditions?: DialogueCondition[];
  scoreRules?: DialogueScoreRule[];
  lines: DialogueViewInstruction[];
}

export interface DialogueBranchGroup {
  id: string;
  selectionStrategy: 'scoreWeighted' | 'rankWeighted';
  rankWeights?: number[];
  candidates: DialogueBranchCandidate[];
}

export interface DialogueViewChoiceLine {
  id?: string;
  type: 'CHOICE';
  speakerId: string;
  text: string;
  expression: Expression;
  idlePrompt?: string;
  idlePromptLines?: DialogueViewLine[];
  timeoutMs: number;
  choices: DialogueViewChoice[];
}

export type DialogueViewInstruction = DialogueViewLine | DialogueViewChoiceLine;

export interface DialogueViewScript {
  id: string;
  participants: DialogueViewParticipant[];
  lines: DialogueViewInstruction[];
  branchGroups?: Record<string, DialogueBranchGroup>;
  branchContext?: DialogueBranchContext;
}

const demoSeeds = CHARACTER_SEEDS.slice(0, 4);

export const DIALOGUE_DEMO_SCRIPT: DialogueViewScript = {
  id: 'demo-court-invite',
  participants: [
    {
      id: demoSeeds[0].id,
      name: demoSeeds[0].name,
      color: demoSeeds[0].color,
      label: demoSeeds[0].label,
      slot: 'left',
    },
    {
      id: demoSeeds[1].id,
      name: demoSeeds[1].name,
      color: demoSeeds[1].color,
      label: demoSeeds[1].label,
      slot: 'right',
    },
    {
      id: demoSeeds[2].id,
      name: demoSeeds[2].name,
      color: demoSeeds[2].color,
      label: demoSeeds[2].label,
      slot: 'center-left',
    },
    {
      id: demoSeeds[3].id,
      name: demoSeeds[3].name,
      color: demoSeeds[3].color,
      label: demoSeeds[3].label,
      slot: 'center-right',
    },
  ],
  lines: [
    {
      id: 'invite-start',
      type: 'SAY',
      speakerId: demoSeeds[0].id,
      text: 'Fuji，現在去球場吧。今天的練習菜單已經排好了。',
      expression: Expression.Normal,
    },
    {
      type: 'SAY',
      speakerId: demoSeeds[1].id,
      text: '你說「排好了」的時候，通常代表沒有人能逃掉吧？',
      expression: Expression.Laugh,
    },
    {
      type: 'SAY',
      speakerId: demoSeeds[2].id,
      text: '我聽到了！如果是雙打的話，我也要加入。',
      expression: Expression.Laugh,
    },
    {
      type: 'SAY',
      speakerId: demoSeeds[3].id,
      text: '先確認大家的體力。勉強練習反而會影響明天。',
      expression: Expression.Normal,
    },
    {
      id: 'practice-choice',
      type: 'CHOICE',
      speakerId: demoSeeds[1].id,
      text: '要接受 Tezuka 的練習邀請嗎？',
      expression: Expression.Normal,
      idlePrompt: '還在嗎？',
      idlePromptLines: [
        {
          type: 'SAY',
          speakerId: demoSeeds[2].id,
          text: 'Fuji 怎麼突然沉默了？是在想戰術嗎？',
          expression: Expression.Normal,
        },
        {
          type: 'SAY',
          speakerId: demoSeeds[3].id,
          text: '也可能只是在觀察我們急起來的樣子。',
          expression: Expression.Normal,
        },
        {
          type: 'SAY',
          speakerId: demoSeeds[1].id,
          text: '呵呵，被發現了。那我再想一下。',
          expression: Expression.Laugh,
        },
      ],
      timeoutMs: 10000,
      choices: [
        {
          id: 'accept',
          label: '接受',
          result: {
            type: 'branch',
            branchGroupId: 'practice-accept-result',
          },
        },
        {
          id: 'rest',
          label: '先休息',
          result: {
            type: 'replaceRemaining',
            lines: [
              {
                type: 'SAY',
                speakerId: demoSeeds[1].id,
                text: '今天先讓我觀察吧。你們認真的樣子也很有意思。',
                expression: Expression.Normal,
              },
              {
                type: 'SAY',
                speakerId: demoSeeds[3].id,
                text: '這樣也好。休息的人可以幫忙看動作。',
                expression: Expression.Normal,
              },
            ],
          },
        },
        {
          id: 'ask-again',
          label: '從頭再確認',
          result: {
            type: 'jumpTo',
            target: {
              type: 'anchor',
              anchorId: 'invite-start',
            },
          },
        },
        {
          id: 'end',
          label: '先結束',
          result: {
            type: 'end',
          },
        },
      ],
    },
    {
      type: 'SAY',
      speakerId: demoSeeds[0].id,
      text: '十分鐘暖身，二十分鐘發球，之後依狀況調整。',
      expression: Expression.Mad,
    },
    {
      type: 'SAY',
      speakerId: demoSeeds[1].id,
      text: '看來今天的風向，是認真模式呢。',
      expression: Expression.Laugh,
    },
  ],
  branchContext: {
    characters: [
      { id: demoSeeds[0].id, traits: ['strict', 'leader'] },
      { id: demoSeeds[1].id, traits: ['playful', 'observer'] },
      { id: demoSeeds[2].id, traits: ['energetic'] },
      { id: demoSeeds[3].id, traits: ['careful'] },
    ],
    relationships: [
      { sourceId: demoSeeds[1].id, targetId: demoSeeds[0].id, intimacy: 64 },
      { sourceId: demoSeeds[0].id, targetId: demoSeeds[1].id, intimacy: 58 },
    ],
  },
  branchGroups: {
    'practice-accept-result': {
      id: 'practice-accept-result',
      selectionStrategy: 'rankWeighted',
      rankWeights: [70, 25, 5],
      candidates: [
        {
          id: 'high-intimacy-direct-accept',
          selectionMode: 'required',
          priority: 100,
          baseWeight: 1,
          conditions: [
            {
              type: 'intimacyRange',
              sourceId: demoSeeds[1].id,
              targetId: demoSeeds[0].id,
              min: 90,
            },
          ],
          lines: [
            {
              type: 'SAY',
              speakerId: demoSeeds[1].id,
              text: '如果是你這麼認真邀請，那我當然會去。',
              expression: Expression.Laugh,
            },
            {
              type: 'SAY',
              speakerId: demoSeeds[0].id,
              text: '那就照最高強度準備。你跟得上。',
              expression: Expression.Normal,
            },
          ],
        },
        {
          id: 'playful-accept',
          selectionMode: 'weighted',
          baseWeight: 10,
          scoreRules: [
            {
              when: {
                type: 'traitIncludes',
                characterId: demoSeeds[1].id,
                trait: 'playful',
              },
              add: 24,
              multiplier: 1.2,
            },
            {
              when: {
                type: 'intimacyRange',
                sourceId: demoSeeds[1].id,
                targetId: demoSeeds[0].id,
                min: 40,
              },
              add: 16,
            },
          ],
          lines: [
            {
              type: 'SAY',
              speakerId: demoSeeds[1].id,
              text: '好啊。既然大家都在，就來打一場有趣的。',
              expression: Expression.Laugh,
            },
            {
              type: 'SAY',
              speakerId: demoSeeds[2].id,
              text: '太好了！我就知道會變成這樣！',
              expression: Expression.Laugh,
            },
          ],
        },
        {
          id: 'careful-accept',
          selectionMode: 'weighted',
          baseWeight: 12,
          scoreRules: [
            {
              when: {
                type: 'traitIncludes',
                characterId: demoSeeds[3].id,
                trait: 'careful',
              },
              add: 18,
            },
          ],
          lines: [
            {
              type: 'SAY',
              speakerId: demoSeeds[3].id,
              text: '可以，但我會控制休息時間。太急會亂掉。',
              expression: Expression.Normal,
            },
            {
              type: 'SAY',
              speakerId: demoSeeds[0].id,
              text: '合理。全員先從暖身開始。',
              expression: Expression.Normal,
            },
          ],
        },
        {
          id: 'default-accept',
          selectionMode: 'weighted',
          baseWeight: 8,
          lines: [
            {
              type: 'SAY',
              speakerId: demoSeeds[0].id,
              text: '全員先從暖身開始。不要跳過基本動作。',
              expression: Expression.Normal,
            },
          ],
        },
      ],
    },
  },
};
