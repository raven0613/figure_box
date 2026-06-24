import {
  SocialStatus,
} from '~/constants/character';
import { ClauseMode, EventActor, EventBlackboard, EventCondition, EventValue, GameEvent, PlayDialogueCommand, RuleClause, ValuePath } from './event';
import { DialogueBank, DialogueScript, DialogueScriptCondition, RuleContext, SelectedDialogue } from './dialogue';
import {
  createParticipantWayOfSayingTemplateValues,
  createWayOfSayingTemplateValues,
} from '~/services/characterWayOfSayingTemplate';
import type { DialogueParticipantRole } from '~/typing/dialogue';

export function canTriggerGameEvent(
  event: GameEvent,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): boolean {
  return matchesEventCondition(event.condition, {
    initiator,
    target,
    blackboard,
    relationship: blackboard.relationship,
  });
}

export function selectDialogueScript(
  command: PlayDialogueCommand,
  dialogueBank: DialogueBank,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): SelectedDialogue | null {
  const context: RuleContext = {
    initiator,
    target,
    blackboard,
    relationship: blackboard.relationship,
  };

  const candidateScripts = dialogueBank.scripts.filter(script => (
    command.scriptId
      ? script.scriptId === command.scriptId
      : script.groupId === command.dialogueGroupId
  ));

  const weightedScripts = candidateScripts
    .map(script => ({
      script,
      weight: getDialogueScriptWeight(script, context),
    }))
    .filter(candidate => candidate.weight > 0);

  const selected = sampleWeighted(
    weightedScripts,
    candidate => candidate.weight,
    blackboard.random ?? Math.random,
  );

  if (!selected) {
    return null;
  }

  return {
    scriptId: selected.script.scriptId,
    groupId: selected.script.groupId,
    weight: selected.weight,
    lines: selected.script.lines.map(line => ({
      ...line,
      text: injectTemplate(line.text, context, line.speaker),
    })),
  };
}

function matchesEventCondition(
  condition: EventCondition,
  context: RuleContext,
): boolean {
  const intimacy = context.relationship?.intimacy ?? 0;

  return (
    matchesOptionalList(context.blackboard.locationId, condition.locationIds)
    && matchesOptionalList(context.blackboard.timeOfDay, condition.timeOfDay)
    && matchesOptionalList(context.blackboard.mutualStatus, condition.mutualStatuses)
    && isAtLeast(intimacy, condition.minIntimacy)
    && isAtMost(intimacy, condition.maxIntimacy)
    && hasAllTraits(context.initiator, condition.initiatorTraits)
    && hasAllTraits(context.target, condition.targetTraits)
    && matchesClauses(condition.clauses, condition.clauseMode, context)
  );
}

function getDialogueScriptWeight(
  script: DialogueScript,
  context: RuleContext,
): number {
  if (context.blackboard.recentScriptIds?.includes(script.scriptId)) {
    return 0;
  }

  if (!matchesDialogueCondition(script.conditions, context)) {
    return 0;
  }

  return (script.weightModifiers ?? []).reduce((weight, modifier) => {
    if (!matchesClause(modifier, context)) {
      return weight;
    }

    return Math.max(0, weight * (modifier.multiplier ?? 1) + (modifier.add ?? 0));
  }, script.baseWeight);
}

function matchesDialogueCondition(
  condition: DialogueScriptCondition | undefined,
  context: RuleContext,
): boolean {
  if (!condition) {
    return true;
  }

  const intimacy = context.relationship?.intimacy ?? 0;

  return (
    hasAllTraits(context.initiator, condition.initiatorTraits)
    && hasAllTraits(context.target, condition.targetTraits)
    && matchesOptionalList(context.initiator.status?.mood, condition.initiatorMoods)
    && matchesOptionalList(context.target.status?.mood, condition.targetMoods)
    && isAtLeast(intimacy, condition.minIntimacy)
    && isAtMost(intimacy, condition.maxIntimacy)
    && matchesClauses(condition.clauses, condition.clauseMode, context)
  );
}

function matchesClauses(
  clauses: RuleClause[] | undefined,
  clauseMode: ClauseMode | undefined,
  context: RuleContext,
): boolean {
  if (!clauses?.length) {
    return true;
  }

  if (clauseMode === 'some') {
    return clauses.some(clause => matchesClause(clause, context));
  }

  return clauses.every(clause => matchesClause(clause, context));
}

function matchesClause(
  clause: RuleClause,
  context: RuleContext,
): boolean {
  const actual = readValue(clause.path, context);
  const expected = clause.value;

  switch (clause.operator) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return Number(actual) > Number(expected);
    case '>=':
      return Number(actual) >= Number(expected);
    case '<':
      return Number(actual) < Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as EventValue);
    case 'includes':
      return Array.isArray(actual) && actual.includes(expected);
    default:
      return false;
  }
}

function readValue(
  path: ValuePath,
  context: RuleContext,
): unknown {
  const [scope, ...segments] = path.split('.');
  const source = getPathSource(scope, context);

  return segments.reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, source);
}

function getPathSource(scope: string, context: RuleContext): unknown {
  switch (scope) {
    case 'initiator':
      return context.initiator;
    case 'target':
      return context.target;
    case 'blackboard':
      return context.blackboard;
    case 'relationship':
      return context.relationship;
    default:
      return undefined;
  }
}

function injectTemplate(
  template: string,
  context: RuleContext,
  speaker: DialogueParticipantRole,
): string {
  const templateValues = createDialogueEventTemplateValues(context, speaker);

  return template.replace(/\$\{([^}]+)\}/g, (_, rawPath: string) => {
    const path = rawPath.trim();
    const value = templateValues[path] ?? readValue(path as ValuePath, context);

    return value == null ? '' : String(value);
  });
}

function createDialogueEventTemplateValues(
  context: RuleContext,
  speaker: DialogueParticipantRole,
): Readonly<Record<string, string>> {
  const speakerWayOfSaying = speaker === 'target'
    ? context.target.wayOfSaying
    : context.initiator.wayOfSaying;

  return {
    ...createParticipantWayOfSayingTemplateValues({
      initiator: context.initiator.wayOfSaying,
      target: context.target.wayOfSaying,
    }),
    ...createWayOfSayingTemplateValues(speakerWayOfSaying),
  };
}

function sampleWeighted<T>(
  candidates: T[],
  getWeight: (candidate: T) => number,
  random: () => number,
): T | null {
  const totalWeight = candidates.reduce((sum, candidate) => sum + getWeight(candidate), 0);

  if (totalWeight <= 0) {
    return null;
  }

  let cursor = random() * totalWeight;

  for (const candidate of candidates) {
    cursor -= getWeight(candidate);

    if (cursor <= 0) {
      return candidate;
    }
  }

  return candidates.at(-1) ?? null;
}

function matchesOptionalList<T>(value: T | undefined, options: T[] | undefined): boolean {
  return !options || (value !== undefined && options.includes(value));
}

function isAtLeast(value: number, floor: number | undefined): boolean {
  return floor === undefined || value >= floor;
}

function isAtMost(value: number, ceiling: number | undefined): boolean {
  return ceiling === undefined || value <= ceiling;
}

function hasAllTraits(actor: EventActor, traits: string[] | undefined): boolean {
  return !traits || traits.every(trait => actor.traits?.includes(trait));
}

export const bumpIntoTargetEvent: GameEvent = {
  id: 'passerby_bump',
  name: '路人 A 撞到 B',
  type: 'auto',
  limitChar: 2,
  baseWeight: 6,
  condition: {
    locationIds: ['street', 'park', 'station'],
    mutualStatuses: [
      SocialStatus.Stranger,
      SocialStatus.Acquaintance,
      SocialStatus.Friend,
    ],
    clauses: [
      {
        path: 'blackboard.values.isCrowded',
        operator: '==',
        value: true,
      },
    ],
  },
  commands: [
    {
      type: 'PLAY_ANIM',
      target: 'initiator',
      emoji: '💥',
      actionTag: 'body.bump.forward',
      durationMs: 800,
    },
    {
      type: 'PLAY_ANIM',
      target: 'target',
      emoji: '💢',
      actionTag: 'body.stagger.back',
      durationMs: 1000,
    },
    {
      type: 'CHANGE_STAT',
      target: 'relationship',
      statPath: 'intimacy',
      operation: 'add',
      value: -2,
    },
    {
      type: 'SET_BLACKBOARD',
      scope: 'relationship',
      key: 'lastPhysicalContact',
      value: 'bump',
    },
  ],
};
