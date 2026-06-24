import { UI_COLORS } from '~/constants/ui';
import type { DialogueTextSegment } from '~/typing/dialogueView';

export interface FormattedDialogueText {
  text: string;
  textSegments?: DialogueTextSegment[];
}

const TEMPLATE_TOKEN_PATTERN = /\$?\{([a-zA-Z0-9_.]+)\}/g;

export function formatDialogueTextWithNameHighlights(
  template: string,
  values: Readonly<Record<string, string>>,
): FormattedDialogueText {
  return formatDialogueTextTemplate(
    template,
    values,
    key => (isNameTemplateKey(key) ? UI_COLORS.dialogueCharacterName : undefined),
  );
}

function formatDialogueTextTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
  getTokenColor: (key: string) => string | undefined,
): FormattedDialogueText {
  const textSegments: DialogueTextSegment[] = [];
  let text = '';
  let lastIndex = 0;
  let hasColoredSegment = false;

  Array.from(template.matchAll(TEMPLATE_TOKEN_PATTERN)).forEach(match => {
    const matchIndex = match.index ?? 0;
    const key = match[1] ?? '';
    const hasReplacement = values[key] !== undefined;
    const replacement = hasReplacement ? values[key] : match[0];
    const color = hasReplacement ? getTokenColor(key) : undefined;

    appendDialogueTextSegment(textSegments, template.slice(lastIndex, matchIndex));
    appendDialogueTextSegment(textSegments, replacement, color);

    text += template.slice(lastIndex, matchIndex);
    text += replacement;
    hasColoredSegment ||= color !== undefined;
    lastIndex = matchIndex + match[0].length;
  });

  appendDialogueTextSegment(textSegments, template.slice(lastIndex));
  text += template.slice(lastIndex);

  return {
    text,
    textSegments: hasColoredSegment ? textSegments : undefined,
  };
}

function appendDialogueTextSegment(
  segments: DialogueTextSegment[],
  text: string,
  color?: string,
): void {
  if (!text) {
    return;
  }

  const previousSegment = segments.at(-1);

  if (previousSegment && previousSegment.color === color) {
    previousSegment.text += text;
    return;
  }

  segments.push(color ? { text, color } : { text });
}

function isNameTemplateKey(key: string): boolean {
  return key.endsWith('Name');
}
