// src/pages/LoginPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The login / create account page shown to unauthenticated users.
//
// Design: full-height, deep navy (#003087) background.
// A centered white card with the PigeonSocial logo, two inputs, and
// Login / Create buttons.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Input, Button, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const { login, createAccount } = useAuth();

  const [usernameInput, setUsernameInput]   = useState('');
  const [passwordInput, setPasswordInput]   = useState('');
  const [errorMessage,  setErrorMessage]    = useState<string | null>(null);
  const [isLoggingIn,   setIsLoggingIn]     = useState(false);
  const [isCreating,    setIsCreating]      = useState(false);

  function clearError() {
    setErrorMessage(null);
  }

  async function handleLogin() {
    setIsLoggingIn(true);
    clearError();
    const errorMsg = login(usernameInput, passwordInput);
    if (errorMsg) setErrorMessage(errorMsg);
    setIsLoggingIn(false);
  }

  async function handleCreateAccount() {
    setIsCreating(true);
    clearError();
    const errorMsg = createAccount(usernameInput, passwordInput);
    if (errorMsg) setErrorMessage(errorMsg);
    setIsCreating(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }

  return (
    <div
      style={{
        minHeight:       '100vh',
        backgroundColor: '#003087',   // PrestoSports navy
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         24,
      }}
    >
      {/* Login card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius:    20,
          padding:         '40px 36px',
          width:           '100%',
          maxWidth:        380,
          boxShadow:       '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo + headline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🐦</div>
          <h1
            style={{
              fontFamily:   'Nunito, sans-serif',
              fontWeight:   800,
              fontSize:     26,
              margin:       0,
              color:        '#003087',
              letterSpacing: '-0.5px',
            }}
          >
            PigeonSocial
          </h1>
          <p
            style={{
              color:    '#8c8c8c',
              fontSize: 13,
              margin:   '4px 0 0',
            }}
          >
            Pigeonhole your bookmarks!
          </p>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            closable
            onClose={clearError}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {/* Username field */}
        <Input
          prefix={<UserOutlined style={{ color: '#aaa' }} />}
          placeholder="Username"
          size="large"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ borderRadius: 10, marginBottom: 12 }}
          autoFocus
          autoComplete="username"
        />

        {/* Password field */}
        <Input.Password
          prefix={<LockOutlined style={{ color: '#aaa' }} />}
          placeholder="Password"
          size="large"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ borderRadius: 10, marginBottom: 20 }}
          autoComplete="current-password"
        />

        {/* Action buttons */}
        <Button
          type="primary"
          block
          size="large"
          loading={isLoggingIn}
          onClick={handleLogin}
          style={{
            borderRadius:    10,
            height:          44,
            backgroundColor: '#003087',
            borderColor:     '#003087',
            fontWeight:      600,
          }}
        >
          Log In
        </Button>

        <Divider style={{ margin: '16px 0', color: '#ccc', fontSize: 12 }}>
          or
        </Divider>

        <Button
          block
          size="large"
          loading={isCreating}
          onClick={handleCreateAccount}
          style={{
            borderRadius: 10,
            height:       44,
            fontWeight:   600,
          }}
        >
          Create Account
        </Button>

        <p
          style={{
            marginTop:  16,
            textAlign:  'center',
            fontSize:   11,
            color:      '#b0b0b0',
            lineHeight: 1.4,
          }}
        >
          This app runs entirely on your device.
          <br />No data is sent to any server.
        </p>
      </div>
    </div>
  );
}
