// src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Root component. Handles:
//   1. Auth gate: unauthenticated users always see LoginPage
//   2. Client-side routing for authenticated users:
//        /           → MainPage (the bookmark feed)
//        /settings   → SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { LoginPage }    from '@/pages/LoginPage';
import { MainPage }     from '@/pages/MainPage';
import { SettingsPage } from '@/pages/SettingsPage';

// ── Ant Design theme overrides ────────────────────────────────────────────────
// We set the primary colour to PigeonSocial's navy blue so AntD components
// (buttons, switches, etc.) automatically use it.
const antdTheme = {
  token: {
    colorPrimary:  '#003087',
    colorLink:     '#0066CC',
    borderRadius:  8,
    fontFamily:    'Inter, system-ui, sans-serif',
  },
};

export default function App() {
  const { isLoggedIn, session, logout } = useAuth();

  // If the user is not logged in, always show the login page
  if (!isLoggedIn || !session) {
    return (
      <ConfigProvider theme={antdTheme}>
        <LoginPage />
      </ConfigProvider>
    );
  }

  // Authenticated: render the app with routing
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<MainPage session={session} onLogout={logout} />}
          />
          <Route
            path="/settings"
            element={<SettingsPage />}
          />
          {/* Redirect anything else back to the homepage */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
