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
