import { type FormEvent, useState } from 'react';
import type { DialogueViewInputLine } from '~/typing/dialogueView';

import styles from './dialogue.module.scss';

interface DialogueInputFormProps {
  inputLine: DialogueViewInputLine;
  onSubmit: (value: string) => void;
}

export function DialogueInputForm({
  inputLine,
  onSubmit,
}: DialogueInputFormProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value.trim() || inputLine.fallbackValue);
  };

  return (
    <form className={styles.inputRow} onSubmit={handleSubmit}>
      <input
        autoFocus
        value={value}
        placeholder={inputLine.fallbackValue}
        aria-label={inputLine.prompt}
        onChange={event => setValue(event.target.value)}
      />
      <button type="submit">確定</button>
    </form>
  );
}
