import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { AccessProvider } from './rbac/AccessProvider';
import { PopupProvider } from './components/PopupModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import { Capacitor } from '@capacitor/core';
import './styles.css';
import './super-admin/super-admin.css';
import './components/student/student-portal.css';
// UI reskin: design tokens + component layer (must load after the existing stylesheets)
import './theme/tokens.css';
import './theme/components.css';
import './theme/auth.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
    window.location.hash = '/login';
  }
  void import('./platform/native').then(({ initializeNativeApp }) => initializeNativeApp()).catch(console.error);
}

// Automatically redirect direct pathname visits for reset-password into HashRouter route
if (typeof window !== 'undefined' && window.location.pathname && window.location.pathname.includes('reset-password')) {
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const query = search || (hash.includes('?') ? hash.slice(hash.indexOf('?')) : '');
  window.location.replace(`${window.location.origin}/#/reset-password${query}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <PopupProvider>
            <ToastProvider>
              <AccessProvider>
                <App />
              </AccessProvider>
            </ToastProvider>
          </PopupProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
