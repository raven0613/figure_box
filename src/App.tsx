import { useCallback, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Expression } from '~/constants/character';
import { DIALOGUE_DEMO_SCRIPT } from '~/constants/dialogueDemo';
import { MAP_DIALOGUE_BOUNCE_DEMO, MAP_DIALOGUE_FADE_DEMO } from '~/constants/mapDialogueDemo';
import i18n from '~/i18n';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { DialogueViewScript } from '~/typing/dialogueView';
import { DialogueWindow } from './components/dialogue/DialogueWindow';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';

function App() {
  const [activeDialogueScript, setActiveDialogueScript] = useState<DialogueViewScript | null>(null);
  const [dialogueExpressionByCharacterId, setDialogueExpressionByCharacterId] = useState<Partial<Record<string, Expression>>>({});
  const [mapDialoguePresentation, setMapDialoguePresentation] = useState<EventDialoguePresentation | null>(null);
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
        <div className={styles.demoControls}>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setActiveDialogueScript(DIALOGUE_DEMO_SCRIPT)}
          >
            Test Dialogue
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_FADE_DEMO })}
          >
            Map Fade
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_BOUNCE_DEMO })}
          >
            Map Bounce
          </button>
        </div>
        {/* <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        /> */}
        {/* <AvatarEditorContainer /> */}
        <TownMapContainer
          expressionByCharacterId={dialogueExpressionByCharacterId}
          mapDialoguePresentation={mapDialoguePresentation}
        />
        {activeDialogueScript ? (
          <DialogueWindow
            script={activeDialogueScript}
            onLineChange={handleDialogueLineChange}
            onClose={() => {
              setActiveDialogueScript(null);
            }}
          />
        ) : null}
      </div>
    </I18nextProvider>
  );
}

export default App;
