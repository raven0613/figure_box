import { imagePathWithTimestamp } from '~/utils/imageTimestamp';

export const IMAGE_BASE_PATH = 'https://gn-event-page.soundon.fm/gn-game-image/horse-racing-image';
export const IMAGE_CORE_BASE_PATH = 'https://gn-event-page.soundon.fm/gn-game-image/gn-game-image-core';

export const timestamp = new Date('2026-03-31T00:00:00.000Z').getTime();

export type PreloadImage = 'COVER' | 'LOADING_BG' | 'LOADING_PROGRESS' | 'BTN_CLOSE' | 'DIALOG_BG';

export type CatImage =
  | 'CAT_GHOST_01'
  | 'CAT_GHOST_02'
  | 'CAT_MAHOSHOJO_01'
  | 'CAT_MAHOSHOJO_02'
  | 'CAT_BASEBALL_01'
  | 'CAT_BASEBALL_02'
  | 'CAT_THIEF_01'
  | 'CAT_THIEF_02'
  | 'CAT_APPLE_01'
  | 'CAT_APPLE_02'
  | 'PROFILE_CAT1'
  | 'PROFILE_CAT2'
  | 'PROFILE_CAT3'
  | 'PROFILE_CAT4'
  | 'PROFILE_CAT5'
  | 'WINNER_GHOST'
  | 'WINNER_MAHOSHOJO'
  | 'WINNER_BASEBALL'
  | 'WINNER_THIEF'
  | 'WINNER_APPLE'
  | 'HISTORY_GHOST'
  | 'HISTORY_MAHOSHOJO'
  | 'HISTORY_BASEBALL'
  | 'HISTORY_THIEF'
  | 'HISTORY_APPLE';

export type Image =
  | 'BG'
  | 'CHIPS_10'
  | 'CHIPS_50'
  | 'CHIPS_100'
  | 'CHIPS_1k'
  | 'CHIPS_10k'
  | 'CHIPS_INDICATOR'
  | 'USER_COIN'
  | 'USER_RECORD'
  | 'MARQUEE_BG'
  | 'BET_TIMER_GRADIENT'
  | 'RACING_BG'
  | 'START_LINE'
  | 'FINISH_LINE'
  | CatImage
  | GifImage;

export type GifImage = 'CONGRATS' | 'BET_TIMER_BG';

export type ImagePathMap<T extends string> = { [key in T]: string };

export const preloadImagesPath: ImagePathMap<PreloadImage> = {
};

export const imagesPath: ImagePathMap<Image> = {

};
