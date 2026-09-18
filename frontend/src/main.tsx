import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import App from './App';
import './styles.css';
import './super-admin/super-admin.css';

// Automatically redirect direct pathname visits for reset-password into HashRouter route
if (typeof window !== 'undefined' && window.location.pathname && window.location.pathname.includes('reset-password')) {
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const query = search || (hash.includes('?') ? hash.slice(hash.indexOf('?')) : '');
  window.location.replace(`${window.location.origin}/#/reset-password${query}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
