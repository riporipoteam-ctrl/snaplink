import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.nativeShell = 'true';
  document.body.classList.add('snaplink-native-shell');
}

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('SnapLink service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
