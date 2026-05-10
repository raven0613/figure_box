import { I18nextProvider } from 'react-i18next';
import i18n from '~/i18n';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <div className={styles.app}>
        {/* <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        /> */}
        {/* <AvatarEditorContainer /> */}
        <TownMapContainer />
      </div>
    </I18nextProvider>
  );
}

export default App;
