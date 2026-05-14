// src/main.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Vite entry point. Mounts the React app into the #root div.
// React.StrictMode is kept on — it intentionally double-invokes effects in
// development to help surface bugs. It has no effect in production builds.
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element #root not found in index.html. Did you delete the <div id="root">?'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
