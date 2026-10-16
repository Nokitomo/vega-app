import type {ContentInventory, Info} from '../providers/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const normalizedStatus = (info?: Info): string =>
  String(info?.extra?.meta?.status || '').trim().toLowerCase();

export const getMetadataCheckInterval = (
  providerValue: string,
  info?: Info,
): number => {
  if (providerValue === 'animeunity') {
    const status = normalizedStatus(info);
    if (/terminat|dropp|complet|finish|ended/.test(status)) {
      return Infinity;
    }
    return 4 * HOUR;
  }
  if (providerValue === 'streamingunity') {
    const status = normalizedStatus(info);
    if (info?.type !== 'series') {
      return info?.linkList?.[0]?.availabilityStatus === 'upcoming'
        ? 6 * HOUR
        : DAY;
    }
    if (/ended|cancelled|canceled/.test(status)) {
      return 7 * DAY;
    }
    return 6 * HOUR;
  }
  return DAY;
};

export const hasContentInventoryChanged = (
  current: Info,
  inventory: ContentInventory,
  previous?: ContentInventory,
): boolean => {
  if (previous) {
    return (
      inventory.status !== previous.status ||
      inventory.episodesCount !== previous.episodesCount ||
      inventory.seasonsSignature !== previous.seasonsSignature ||
      inventory.availabilityStatus !== previous.availabilityStatus
    );
  }
  const currentStatus = normalizedStatus(current);
  const newStatus = String(inventory.status || '').trim().toLowerCase();
  if (currentStatus && newStatus && currentStatus !== newStatus) {
    return true;
  }
  if (
    current.episodesCount != null &&
    inventory.episodesCount != null &&
    current.episodesCount !== inventory.episodesCount
  ) {
    return true;
  }
  if (
    inventory.availabilityStatus &&
    current.linkList?.[0]?.availabilityStatus &&
    inventory.availabilityStatus !== current.linkList[0].availabilityStatus
  ) {
    return true;
  }
  if (inventory.seasonsSignature && current.type === 'series') {
    try {
      const liveSeasons = JSON.parse(inventory.seasonsSignature) as Array<{
        number: number;
      }>;
      const cachedSeasons = current.linkList
        .map(season => season.seasonNumber)
        .filter((number): number is number => number != null);
      if (
        liveSeasons.length !== cachedSeasons.length ||
        liveSeasons.some(
          (season, index) => season.number !== cachedSeasons[index],
        )
      ) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
};
