import rawOfflineRecapTemplates from '~/constants/offlineRecapTemplates.json';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventDefinition,
} from '~/constants/charactarEventsDefinitions';
import { loadOfflineRecapTemplates } from '~/utils/jsonParser/offlineRecapTemplateSchema';
import type { CharacterEventCandidate } from '~/services/characterEvents/types';
import type {
  OfflineRecapTemplate,
  OfflineRecapTemplates,
  OfflineResolutionPreview,
  ResolvedOfflineRecapTemplate,
} from './types';

export const OFFLINE_RECAP_TEMPLATES: OfflineRecapTemplates =
  loadOfflineRecapTemplates(rawOfflineRecapTemplates);

export function resolveOfflineRecapTemplate(
  candidate: Pick<CharacterEventCandidate, 'id' | 'motivation' | 'event'>,
  resolutionPreview?: OfflineResolutionPreview,
): ResolvedOfflineRecapTemplate {
  const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[candidate.id];
  const selectedVariant = resolutionPreview?.kind === 'group'
    ? definition?.presentationVariants
      ?.find(variant => variant.id === resolutionPreview.presentationVariantId)
    : undefined;
  const activity = selectedVariant?.activity ?? findPrimaryActivity(definition);
  const outcomeBranch = resolutionPreview?.kind === 'group' && resolutionPreview.outcomeId
    ? selectedVariant?.activity?.rolls
      ?.flatMap(roll => roll.branches)
      .find(branch => branch.id === resolutionPreview.outcomeId)
    : undefined;
  const templateLayers: readonly { source: string; template?: OfflineRecapTemplate }[] = [
    { source: 'fallback', template: OFFLINE_RECAP_TEMPLATES.fallback },
    {
      source: `motivation.${candidate.motivation}`,
      template: OFFLINE_RECAP_TEMPLATES.motivation[candidate.motivation],
    },
    {
      source: `eventType.${candidate.event.type}`,
      template: OFFLINE_RECAP_TEMPLATES.eventType[candidate.event.type],
    },
    {
      source: activity ? `activityType.${activity.type}` : 'activityType.none',
      template: activity ? OFFLINE_RECAP_TEMPLATES.activityType[activity.type] : undefined,
    },
    {
      source: `eventOverrides.${candidate.id}`,
      template: OFFLINE_RECAP_TEMPLATES.eventOverrides[candidate.id],
    },
    {
      source: `characterEvents.${candidate.id}.offlineRecap`,
      template: definition?.offlineRecap,
    },
    {
      source: `characterEvents.${candidate.id}.presentationVariants.${selectedVariant?.id}.offlineRecap`,
      template: selectedVariant?.offlineRecap,
    },
    {
      source: `characterEvents.${candidate.id}.outcomes.${outcomeBranch?.id}.offlineRecap`,
      template: outcomeBranch?.offlineRecap,
    },
  ];

  return templateLayers.reduce<ResolvedOfflineRecapTemplate>(
    (resolvedTemplate, layer) => {
      if (!layer.template) {
        return resolvedTemplate;
      }

      return {
        source: layer.source,
        template: {
          ...resolvedTemplate.template,
          ...layer.template,
          summary: layer.template.summary ?? resolvedTemplate.template.summary,
        },
      };
    },
    {
      source: 'fallback',
      template: OFFLINE_RECAP_TEMPLATES.fallback,
    },
  );
}

export function getOfflineCandidateActivityType(
  candidate: Pick<CharacterEventCandidate, 'id'>,
): CharacterEventActivity['type'] | undefined {
  return findPrimaryActivity(CHARACTER_EVENT_DEFINITIONS_BY_ID[candidate.id])?.type;
}

function findPrimaryActivity(
  definition: CharacterEventDefinition | undefined,
): CharacterEventActivity | undefined {
  return definition?.presentationVariants
    ?.find(variant => variant.activity)
    ?.activity;
}
