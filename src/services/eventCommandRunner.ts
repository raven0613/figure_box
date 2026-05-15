import type { DialogueBank } from '~/constants/dialogue';
import type { EventActor, EventBlackboard, GameEvent } from '~/constants/event';
import { createDialogueViewScriptFromPlayDialogueCommand } from '~/services/dialogueViewAdapter';
import type { DialogueViewScript } from '~/typing/dialogueView';

export function resolveDialogueViewScriptsFromGameEvent(
  event: GameEvent,
  dialogueBank: DialogueBank,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): DialogueViewScript[] {
  return event.commands.flatMap(command => {
    if (command.type !== 'PLAY_DIALOGUE') {
      return [];
    }

    const dialogueScript = createDialogueViewScriptFromPlayDialogueCommand(
      command,
      dialogueBank,
      initiator,
      target,
      blackboard,
    );

    return dialogueScript ? [dialogueScript] : [];
  });
}
