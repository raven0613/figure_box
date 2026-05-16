export type InteractionType = 'chat' | 'play';

export interface InteractionProposalCopy {
  proposalTemplate: string;
  acceptedTemplate: string;
  rejectedMoodTemplate: string;
  activeTemplate: string;
  endTemplate: string;
  proposalDurationMs: number;
  activeDurationMs: number;
}

export interface InteractionProposalConfig {
  interactionType: InteractionType;
  copy: InteractionProposalCopy;
}

export const CHAT_INTERACTION_DURATION_MS = 20000;
export const DEFAULT_ACTIVE_BUBBLE_DELAY_MS = 1200;
export const DEFAULT_PLAY_DURATION_MS = 20000;
export const END_BUBBLE_DURATION_MS = 1800;

export const INTERACTION_CONFIGS: Record<InteractionType, InteractionProposalConfig> = {
  chat: {
    interactionType: 'chat',
    copy: {
      proposalTemplate: '{initiator}：要不要聊一下？',
      acceptedTemplate: '{target}：好啊。',
      rejectedMoodTemplate: '{target}：現在有點不想聊。',
      activeTemplate: '正在聊天',
      endTemplate: '聊完了。',
      proposalDurationMs: 3200,
      activeDurationMs: CHAT_INTERACTION_DURATION_MS,
    },
  },
  play: {
    interactionType: 'play',
    copy: {
      proposalTemplate: '{initiator}：一起玩嗎？',
      acceptedTemplate: '{target}：好，一起玩！',
      rejectedMoodTemplate: '{target}：我現在不想玩。',
      activeTemplate: '正在一起玩',
      endTemplate: '一起玩完了。',
      proposalDurationMs: 2600,
      activeDurationMs: 5000,
    },
  },
};
