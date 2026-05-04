import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './index.scss';
import { gameManagerService } from './services/gameManagerService';

(async function main() {

  const start = await gameManagerService.load();

  start();

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
