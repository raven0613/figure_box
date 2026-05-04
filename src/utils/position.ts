export const getRandomPosition = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};
