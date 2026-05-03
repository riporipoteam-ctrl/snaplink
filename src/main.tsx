import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.nativeShell = 'true';
  document.body.classList.add('snaplink-native-shell');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
