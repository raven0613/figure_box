import type { ItemTransferHistoryEntry } from '~/typing/item';

export function appendItemTransferHistoryEntry(
  transferHistory: readonly ItemTransferHistoryEntry[] | undefined,
  nextEntry: ItemTransferHistoryEntry,
): readonly ItemTransferHistoryEntry[] {
  if (!transferHistory || transferHistory.length === 0) {
    return [nextEntry];
  }

  const lastEntry = transferHistory[transferHistory.length - 1];

  if (!canMergeTransferHistoryEntries(lastEntry, nextEntry)) {
    return [...transferHistory, nextEntry];
  }

  return [
    ...transferHistory.slice(0, -1),
    {
      ...lastEntry,
      quantity: lastEntry.quantity + nextEntry.quantity,
    },
  ];
}

function canMergeTransferHistoryEntries(
  currentEntry: ItemTransferHistoryEntry,
  nextEntry: ItemTransferHistoryEntry,
): boolean {
  return (
    currentEntry.reason === nextEntry.reason &&
    currentEntry.fromActorId === nextEntry.fromActorId &&
    currentEntry.toActorId === nextEntry.toActorId &&
    currentEntry.day === nextEntry.day &&
    currentEntry.timeOfDay === nextEntry.timeOfDay
  );
}
