import { DialogueScriptDocument } from "~/typing/dialogue";
import { Mood, DirectedRelationship, Expression } from "./character";
import { ClauseMode, RuleClause, EventActor, EventBlackboard, ParticipantRole } from "./event";

export interface DialogueBank {
    scripts: DialogueScript[];
}

export interface DialogueScript {
    scriptId: string;
    groupId: string;
    baseWeight: number;
    conditions?: DialogueScriptCondition;
    weightModifiers?: WeightModifier[];
    lines: DialogueLine[];
}

export interface DialogueScriptCondition {
    initiatorTraits?: string[];
    targetTraits?: string[];
    initiatorMoods?: Mood[];
    targetMoods?: Mood[];
    minIntimacy?: number;
    maxIntimacy?: number;
    clauseMode?: ClauseMode;
    clauses?: RuleClause[];
}

export interface RuleContext {
    initiator: EventActor;
    target: EventActor;
    blackboard: EventBlackboard;
    relationship?: DirectedRelationship;
}

export interface WeightModifier extends RuleClause {
    multiplier?: number;
    add?: number;
}

export interface DialogueLine {
    speaker: ParticipantRole;
    text: string;
    expression?: Expression;
}

export interface SelectedDialogue {
    scriptId: string;
    groupId: string;
    weight: number;
    lines: DialogueLine[];
}

// 純對話假資料
export const INVITATION_DIALOGUE: DialogueScriptDocument = {
    id: 'invite-tennis-with-choice',
    lines: [
        {
            type: 'SAY',
            speaker: 'initiator',
            text: 'Fuji，現在去球場吧！今天的發球一定能燃起來！',
            expression: Expression.Normal,
        },
        {
            type: 'SAY',
            speaker: 'target',
            text: '你每次都這麼有精神耶，Tezuka。',
            expression: Expression.Laugh,
        },
        {
            type: 'CHOICE',
            speaker: 'target',
            text: '要接受 Tezuka 的邀請嗎？',
            expression: Expression.Normal,
            choices: [
                {
                    id: 'accept',
                    label: '接受',
                    nextLines: [
                        {
                            type: 'SAY',
                            speaker: 'target',
                            text: '好啊，我陪你打一下。',
                            expression: Expression.Normal,
                        },
                        {
                            type: 'SAY',
                            speaker: 'initiator',
                            text: '太好了，走吧！',
                            expression: Expression.Laugh,
                        },
                    ],
                },
                {
                    id: 'reject',
                    label: '拒絕',
                    nextLines: [
                        {
                            type: 'SAY',
                            speaker: 'target',
                            text: '今天先不要，我想休息一下。',
                            expression: Expression.Cry,
                        },
                        {
                            type: 'SAY',
                            speaker: 'initiator',
                            text: '了解，那下次再約。',
                            expression: Expression.Normal,
                        },
                    ],
                },
            ],
        },
    ],
};
