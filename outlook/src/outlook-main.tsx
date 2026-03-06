import React from 'react';
import ReactDOM from 'react-dom/client';
import { IOConnectProvider } from '@interopio/react-hooks';
import IOBrowser from '@interopio/browser';
import OutlookApp from './OutlookApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IOConnectProvider settings={{ browser: { factory: IOBrowser } }}>
      <OutlookApp />
    </IOConnectProvider>
  </React.StrictMode>
);
