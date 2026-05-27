import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type {
  OfflineSimulationPolicy,
  OfflineTimeOfDayBucketPolicy,
} from './types';

const MINUTES_PER_DAY = 24 * 60;

export function isOfflineActivityAvailableAt(
  activity: CharacterEventActivity,
  timestamp: number,
  policy: OfflineSimulationPolicy,
): boolean {
  const availability = activity.availability;

  if (!availability) {
    return true;
  }

  const minuteOfDay = getLocalMinuteOfDay(timestamp);
  const timeBucketId = getOfflineTimeBucketId(timestamp, policy);
  const matchesTimeOfDay = availability.timeOfDay === undefined ||
    (timeBucketId !== null && availability.timeOfDay.includes(timeBucketId));
  const matchesTimeWindow = availability.timeWindows === undefined ||
    availability.timeWindows.some(window => isMinuteInRange(minuteOfDay, window.fromMinute, window.toMinute));

  return matchesTimeOfDay && matchesTimeWindow;
}

export function getOfflineTimeBucketKey(
  timestamp: number,
  policy: OfflineSimulationPolicy,
): string {
  const bucket = getOfflineTimeBucket(timestamp, policy);
  const date = new Date(timestamp);
  const localDateKey = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return bucket ? `${localDateKey}:${bucket.id}` : `${localDateKey}:unbucketed`;
}

export function getOfflineTimeBucketOrder(
  timestamp: number,
  policy: OfflineSimulationPolicy,
): number {
  const bucket = getOfflineTimeBucket(timestamp, policy);
  const dayStart = new Date(timestamp);
  dayStart.setHours(0, 0, 0, 0);

  return dayStart.getTime() + (bucket?.startMinute ?? getLocalMinuteOfDay(timestamp)) * 60_000;
}

export function getOfflineTimeBucketId(
  timestamp: number,
  policy: OfflineSimulationPolicy,
): string | null {
  return getOfflineTimeBucket(timestamp, policy)?.id ?? null;
}

function getOfflineTimeBucket(
  timestamp: number,
  policy: OfflineSimulationPolicy,
): OfflineTimeOfDayBucketPolicy | null {
  const minuteOfDay = getLocalMinuteOfDay(timestamp);

  return policy.timeOfDay.buckets.find(bucket => (
    isMinuteInRange(minuteOfDay, bucket.startMinute, bucket.endMinute)
  )) ?? null;
}

function getLocalMinuteOfDay(timestamp: number): number {
  const date = new Date(timestamp);

  return date.getHours() * 60 + date.getMinutes();
}

function isMinuteInRange(
  minuteOfDay: number,
  rawStartMinute: number,
  rawEndMinute: number,
): boolean {
  const startMinute = normalizeMinute(rawStartMinute);
  const endMinute = normalizeMinute(rawEndMinute);

  if (startMinute === endMinute) {
    return false;
  }

  return startMinute < endMinute
    ? minuteOfDay >= startMinute && minuteOfDay < endMinute
    : minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

function normalizeMinute(minute: number): number {
  return minute >= MINUTES_PER_DAY ? 0 : minute;
}
