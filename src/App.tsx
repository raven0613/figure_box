import { useCallback, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Expression } from '~/constants/character';
import { DIALOGUE_DEMO_SCRIPT } from '~/constants/dialogueDemo';
import i18n from '~/i18n';
import { DialogueWindow } from './components/dialogue/DialogueWindow';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';

function App() {
  const [isDialogueDemoOpen, setIsDialogueDemoOpen] = useState(false);
  const [dialogueExpressionByCharacterId, setDialogueExpressionByCharacterId] = useState<Partial<Record<string, Expression>>>({});
  const handleDialogueLineChange = useCallback((line: { speakerId: string; expression: Expression }) => {
    setDialogueExpressionByCharacterId(current => {
      if (current[line.speakerId] === line.expression) {
        return current;
      }

      return {
        ...current,
        [line.speakerId]: line.expression,
      };
    });
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <div className={styles.app}>
        <button
          className={styles.dialogueDemoButton}
          type="button"
          onClick={() => setIsDialogueDemoOpen(true)}
        >
          Test Dialogue
        </button>
        {/* <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        /> */}
        {/* <AvatarEditorContainer /> */}
        <TownMapContainer expressionByCharacterId={dialogueExpressionByCharacterId} />
        {isDialogueDemoOpen ? (
          <DialogueWindow
            script={DIALOGUE_DEMO_SCRIPT}
            onLineChange={handleDialogueLineChange}
            onClose={() => {
              setIsDialogueDemoOpen(false);
            }}
          />
        ) : null}
      </div>
    </I18nextProvider>
  );
}

export default App;
