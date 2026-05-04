import { IMAGE_BASE_PATH } from '~/constants/paths';

export const getRacingScript = async () => {
  try {
    const res = await fetch(`${IMAGE_BASE_PATH}/racing_script.json`);
    if (res.status === 200) {
      return await res.json();
    }
  } catch (error) {
    console.log(error);
  }
};
