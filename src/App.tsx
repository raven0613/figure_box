import { I18nextProvider } from 'react-i18next';
import History from '~/components/History';
import i18n from '~/i18n';
import styles from './App.module.scss';
import { FabricDrawingBoardContainer } from './components/drawingBoard/FabricDrawingBoardContainer';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <div className={styles.app}>
        <History />
        <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        />
      </div>
    </I18nextProvider>
  );
}

export default App;
