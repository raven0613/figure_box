import { Expression } from '~/constants/character';
import type { DialogueBank } from '~/constants/dialogue';
import type { EventActor, EventBlackboard, GameEvent } from '~/constants/event';
import { selectDialogueScript } from '~/constants/dialogueEvents';
import { createDialogueViewScriptFromSelectedDialogue } from '~/services/dialogueViewAdapter';
import type { EventDialoguePresentation, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { DialogueViewScript } from '~/typing/dialogueView';

const DEFAULT_MAP_PREVIEW_LINE_COUNT = 1;
const DEFAULT_MAP_BUBBLE_INTERVAL_MS = 1800;
const DEFAULT_MAP_BUBBLE_DURATION_MS = 1600;
const DEFAULT_MAP_DIALOGUE_VISIBLE_ZOOM = 3.4;

export function resolveDialogueViewScriptsFromGameEvent(
  event: GameEvent,
  dialogueBank: DialogueBank,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): DialogueViewScript[] {
  return resolveEventDialoguePresentationsFromGameEvent(event, dialogueBank, initiator, target, blackboard)
    .flatMap(presentation => presentation.dialogueScript ? [presentation.dialogueScript] : []);
}

export function resolveEventDialoguePresentationsFromGameEvent(
  event: GameEvent,
  dialogueBank: DialogueBank,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): EventDialoguePresentation[] {
  return event.commands.flatMap((command, commandIndex) => {
    if (command.type !== 'PLAY_DIALOGUE') {
      return [];
    }

    const selectedDialogue = selectDialogueScript(command, dialogueBank, initiator, target, blackboard);

    if (!selectedDialogue) {
      return [];
    }

    const mode = command.displayMode ?? 'preview';
    const participantIds = [initiator.id, target.id];
    const sequenceLines = selectedDialogue.lines.map<MapBubbleSequenceLine>(line => ({
      characterId: line.speaker === 'target' ? target.id : initiator.id,
      text: line.text,
      expression: line.expression ?? Expression.Normal,
    }));
    const previewLineCount = Math.max(1, command.mapPreviewLineCount ?? DEFAULT_MAP_PREVIEW_LINE_COUNT);
    const visibleLines = mode === 'ambient'
      ? sequenceLines
      : sequenceLines.slice(0, previewLineCount);
    const visibleAtZoom = command.mapVisibleAtZoom ?? DEFAULT_MAP_DIALOGUE_VISIBLE_ZOOM;
    const bubbleSequence = visibleLines.length > 0
      ? {
        id: `${event.id}-${commandIndex}-map-bubbles`,
        lines: visibleLines,
        animation: command.mapBubbleAnimation ?? (mode === 'ambient' ? 'bounceAway' : 'fade'),
        intervalMs: command.mapBubbleIntervalMs ?? DEFAULT_MAP_BUBBLE_INTERVAL_MS,
        bubbleDurationMs: DEFAULT_MAP_BUBBLE_DURATION_MS,
        visibleAtZoom,
      }
      : undefined;
    const participants = [
      {
        id: initiator.id,
        role: 'initiator' as const,
        name: initiator.name,
      },
      {
        id: target.id,
        role: 'target' as const,
        name: target.name,
      },
    ];
    const dialogueScript = mode === 'preview'
      ? createDialogueViewScriptFromSelectedDialogue(selectedDialogue, participants)
      : undefined;

    return [{
      mode,
      activity: {
        id: `${event.id}-${commandIndex}-activity`,
        participantIds,
        label: command.mapLabel ?? event.name,
        visibleAtZoom,
        previewLine: visibleLines[0],
      },
      dialogueScript,
      bubbleSequence,
    }];
  });
}
