import type { AvatarPartOption } from './avatarTypes';

const avatarAssetUrls = import.meta.glob<string>('../../assets/avatar_system/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function hasAvatarAsset(folder: string, file: string): boolean {
  const assetPath = `../../assets/avatar_system/${folder}/${file}`;
  return avatarAssetUrls[assetPath] !== undefined;
}

export function getAvatarAssetUrl(folder: string, file: string): string {
  const normalizedFile = file.replace('__right', '');
  const assetPath = `../../assets/avatar_system/${folder}/${normalizedFile}`;
  const url = avatarAssetUrls[assetPath];

  if (!url) {
    throw new Error(`Avatar asset not found: ${assetPath}`);
  }

  return url;
}

export function getAvatarAssetPaths(): string[] {
  return Object.keys(avatarAssetUrls);
}

export function createAssetOptionDefinitions(folder: string, label: string): AvatarPartOption[] {
  const optionIds = new Set<number>();
  const assetPathPattern = new RegExp(`^\\.\\./\\.\\./assets/avatar_system/${folder}/(\\d+)(?:_.*)?\\.png$`);

  getAvatarAssetPaths().forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (!match) {
      return;
    }

    optionIds.add(Number(match[1]));
  });

  return [...optionIds]
    .sort((first, second) => first - second)
    .map(id => ({
      id,
      label: `${label} ${id}`,
    }));
}

export function createHairLightOptionDefinitions(): AvatarPartOption[] {
  const optionIds = new Set<number>();
  const assetPathPattern = /^\.\.\/\.\.\/assets\/avatar_system\/(?:mini\/)?hair_light\/(?:back\/|side\/)?(\d+)(?:_.*)?\.png$/;

  getAvatarAssetPaths().forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (match) {
      optionIds.add(Number(match[1]));
    }
  });

  return [
    { id: 0, label: '無', isColorEditable: false },
    ...[...optionIds]
      .sort((first, second) => first - second)
      .map(id => ({ id, label: `hair light ${id}` })),
  ];
}

export function createMouthOptionDefinitions(): AvatarPartOption[] {
  return createAssetOptionDefinitions('mouth', 'mouth').map(option => ({
    ...option,
    isColorEditable: hasAvatarAsset('mouth', `${formatOptionId(option.id)}_color.png`),
  }));
}

export function createMiniDirectoryOptionDefinitions(
  folder: string,
  label: string,
  nonTintableOptionIds = new Set<number>(),
): AvatarPartOption[] {
  const optionIds = new Set<number>();
  const assetPathPattern = new RegExp(`^\\.\\./\\.\\./assets/avatar_system/mini/${folder}/(\\d+)/`);

  getAvatarAssetPaths().forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (!match) {
      return;
    }

    optionIds.add(Number(match[1]));
  });

  return [...optionIds]
    .sort((first, second) => first - second)
    .map(id => ({
      id,
      label: `${label} ${id}`,
      isColorEditable: !nonTintableOptionIds.has(id),
    }));
}

export function formatOptionId(optionId: number): string {
  return String(optionId).padStart(2, '0');
}
