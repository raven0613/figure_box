import { describe, expect, test } from 'vitest';
import type { CharacterRequest } from './types';
import { matchesItemRequest } from './matching';

const SHINY_ITEM_REQUEST: CharacterRequest = {
  id: 'request-a',
  definitionId: 'minor.item.shiny',
  characterId: 'character-a',
  level: 'minor',
  kind: 'item',
  status: 'active',
  label: '想要有點稀有又閃亮的東西',
  target: {
    itemMatch: {
      tagsAnyOf: ['shiny'],
      minRarity: 'uncommon',
    },
  },
  createdAt: 1,
  expiresAt: null,
};

describe('matchesItemRequest', () => {
  test('matches item request by target itemMatch definition rules', () => {
    const didMatch = matchesItemRequest(SHINY_ITEM_REQUEST, {
      characterId: 'character-a',
      itemId: 'clear_gem',
      itemDefinition: {
        id: 'clear_gem',
        nameKey: 'item.clearGem.name',
        type: 'generic',
        category: 'gem',
        tags: ['shiny', 'craftMaterial'],
        rarity: 'uncommon',
        stackable: true,
        maxStack: 99,
        visual: {
          assetId: 'item/clear_gem',
        },
      },
    });

    expect(didMatch).toBe(true);
  });

  test('does not match item below minimum rarity', () => {
    const didMatch = matchesItemRequest(SHINY_ITEM_REQUEST, {
      characterId: 'character-a',
      itemId: 'glass_bead',
      itemDefinition: {
        id: 'glass_bead',
        nameKey: 'item.glassBead.name',
        type: 'generic',
        category: 'gem',
        tags: ['shiny'],
        rarity: 'common',
        stackable: true,
        maxStack: 99,
        visual: {
          assetId: 'item/glass_bead',
        },
      },
    });

    expect(didMatch).toBe(false);
  });
});
