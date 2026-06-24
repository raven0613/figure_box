import type { CharacterWayOfSaying } from '~/typing/characterProfile';

export type CharacterWayOfSayingToken = keyof Required<CharacterWayOfSaying>;

export const DEFAULT_CHARACTER_WAY_OF_SAYING: Required<CharacterWayOfSaying> = {
  beginning: '',
  chuckle: '呵呵',
  laugh: '哈哈',
  ending: '',
  selfReference: '我',
};

export function createWayOfSayingTemplateValues(
  wayOfSaying?: CharacterWayOfSaying | null,
): Record<CharacterWayOfSayingToken, string> {
  return {
    beginning: wayOfSaying?.beginning ?? DEFAULT_CHARACTER_WAY_OF_SAYING.beginning,
    chuckle: wayOfSaying?.chuckle ?? DEFAULT_CHARACTER_WAY_OF_SAYING.chuckle,
    laugh: wayOfSaying?.laugh ?? DEFAULT_CHARACTER_WAY_OF_SAYING.laugh,
    ending: wayOfSaying?.ending ?? DEFAULT_CHARACTER_WAY_OF_SAYING.ending,
    selfReference: wayOfSaying?.selfReference ?? DEFAULT_CHARACTER_WAY_OF_SAYING.selfReference,
  };
}

export function createParticipantWayOfSayingTemplateValues(
  wayOfSayingByParticipantKey: Readonly<Record<string, CharacterWayOfSaying | null | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(wayOfSayingByParticipantKey).flatMap(([participantKey, wayOfSaying]) => (
      Object.entries(createWayOfSayingTemplateValues(wayOfSaying)).flatMap(([token, value]) => [
        [`${participantKey}.${token}`, value],
        [`${participantKey}${capitalizeTemplateToken(token)}`, value],
      ])
    )),
  );
}

export function formatTemplateWithValues(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\$?\{([a-zA-Z0-9_.]+)\}/g, (match, key: string) => (
    values[key] ?? match
  ));
}

function capitalizeTemplateToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}
