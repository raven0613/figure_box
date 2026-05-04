import { timestamp } from '~/constants/paths';

export const imagePathWithTimestamp = (basePath: string, imgName: string, isGif?: boolean) => {
  return `${basePath}/${imgName}.${isGif ? 'gif' : 'png'}?timestamp=${timestamp}`;
};
