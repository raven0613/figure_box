import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventActivityEffects,
  type CharacterEventPresentationVariant,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterPerformanceSelection } from '~/services/characterEvents/characterPerformanceRunner';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';

export class TownActivityDefinitionResolver {
  getSelectedActivityDefinition(snapshot: CharacterSnapshot): CharacterEventActivity | undefined {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const variantId = snapshot.context.lastEventDecision?.selectedPresentationVariantId;

    if (!definitionId || !variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.presentationVariants
      ?.find(variant => variant.id === variantId)
      ?.activity;
  }

  getActivityDefinition(activity: JoinableActivity): CharacterEventActivity | undefined {
    return this.getActivityPresentationVariant(activity)?.activity;
  }

  getActivityPerformanceSelection(activity: JoinableActivity): CharacterPerformanceSelection {
    return {
      definitionId: activity.sourceEventId,
      variantId: this.getActivityPresentationVariant(activity)?.id,
    };
  }

  getActivityEffects(activity: JoinableActivity): CharacterEventActivityEffects | undefined {
    return this.getActivityPresentationVariant(activity)?.activity?.effects;
  }

  getActivityEffectsByRole(
    activity: JoinableActivity,
  ): CharacterEventActivity['effectsByRole'] {
    return this.getActivityPresentationVariant(activity)?.activity?.effectsByRole;
  }

  private getActivityPresentationVariant(activity: JoinableActivity): CharacterEventPresentationVariant | undefined {
    return CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
      ?.find(variant => variant.activity?.key === activity.activityKey);
  }
}
