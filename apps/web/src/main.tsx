import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { PageContextProvider } from './lib/pageContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PageContextProvider>
          <App />
        </PageContextProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
