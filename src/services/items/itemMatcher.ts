import type {
  ItemDefinition,
  ItemMatch,
  ItemRarity,
} from '~/typing/item';

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  special: 5,
};

export function matchesItemDefinition(
  itemDefinition: ItemDefinition,
  match: ItemMatch,
): boolean {
  if (match.itemIds && !match.itemIds.includes(itemDefinition.id)) {
    return false;
  }

  if (match.types && !match.types.includes(itemDefinition.type)) {
    return false;
  }

  if (match.categories && !match.categories.includes(itemDefinition.category)) {
    return false;
  }

  if (match.rarities && !match.rarities.includes(itemDefinition.rarity)) {
    return false;
  }

  if (match.minRarity && !isRarityAtLeast(itemDefinition.rarity, match.minRarity)) {
    return false;
  }

  if (match.tagsAnyOf && !match.tagsAnyOf.some(tag => itemDefinition.tags.includes(tag))) {
    return false;
  }

  if (match.tagsAllOf && !match.tagsAllOf.every(tag => itemDefinition.tags.includes(tag))) {
    return false;
  }

  if (match.tagsNoneOf && match.tagsNoneOf.some(tag => itemDefinition.tags.includes(tag))) {
    return false;
  }

  return true;
}

function isRarityAtLeast(rarity: ItemRarity, minRarity: ItemRarity): boolean {
  return getRarityRank(rarity) >= getRarityRank(minRarity);
}

function getRarityRank(rarity: ItemRarity): number {
  return RARITY_RANK[rarity] ?? RARITY_RANK.common;
}
