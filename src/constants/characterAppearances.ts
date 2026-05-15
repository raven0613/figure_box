import { CHARACTER_SEEDS, type CharacterBaseSetting } from './character';
import type { CharacterAppearanceCatalog } from '~/typing/characterAvatar';

interface CharacterAppearanceSeed {
  name: string;
  color: string;
}

export const CHARACTER_APPEARANCES: CharacterAppearanceCatalog = Object.fromEntries(
  CHARACTER_SEEDS.map(seed => [
    seed.id,
    createCharacterAppearance({
      name: seed.name,
      color: seed.color,
    }),
  ]),
);

function createCharacterAppearance(seed: CharacterAppearanceSeed): CharacterBaseSetting {
  const skinColor = createSkinColor(seed.color);

  return {
    name: seed.name,
    avatar: {
      eyes: {
        offsetX: 0,
        offsetY: 0,
        rotate: 0,
        scale: 1,
        sclera: '#fff8ef',
        color: seed.color,
        pupil: '#241d24',
        upperEyelid: createDecorativePart('#6b4b45'),
        lowerEyelid: createDecorativePart('#ad7663'),
        light: {
          ...createDecorativePart('#ffffff'),
          zIndex: 0,
        },
      },
      hair: {
        bangs: createDecorativePart(seed.color),
        sideburns: createDecorativePart(seed.color),
        topHair: createDecorativePart(seed.color),
        backHair: createDecorativePart(seed.color),
        light: createDecorativePart('#ffffff'),
      },
      mouth: createDecorativePart('#8b4141'),
      nose: createDecorativePart('#b87b68'),
      face: {
        id: 0,
        color: skinColor,
        path: '',
      },
    },
    wayOfSaying: {
      beginning: '',
      chuckle: '呵呵',
      laugh: '哈哈',
      ending: '',
      selfReference: '我',
    },
  };
}

function createDecorativePart(color: string): {
  id: 0;
  color: string;
  offsetX: number;
  offsetY: number;
  rotate: number;
  scale: number;
  path: string;
} {
  return {
    id: 0,
    color,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
    scale: 1,
    path: '',
  };
}

function createSkinColor(sourceColor: string): string {
  const red = Number.parseInt(sourceColor.slice(1, 3), 16);
  const green = Number.parseInt(sourceColor.slice(3, 5), 16);
  const blue = Number.parseInt(sourceColor.slice(5, 7), 16);

  if ([red, green, blue].some(value => Number.isNaN(value))) {
    return '#f1c8aa';
  }

  const warmRed = Math.round(red * 0.18 + 230 * 0.82);
  const warmGreen = Math.round(green * 0.12 + 190 * 0.88);
  const warmBlue = Math.round(blue * 0.1 + 162 * 0.9);

  return `#${toHex(warmRed)}${toHex(warmGreen)}${toHex(warmBlue)}`;
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}
