// src/components/AppHeader.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The sticky top navigation bar.
//
// Mobile layout (single row):
//   [🐦 PigeonSocial]  ←── flex-grow ──→  [Hi, username]  [☰]
//
// Desktop layout (two rows):
//   Row 1: [🐦 PigeonSocial]
//   Row 2: [Import ▾]  [Manage Folders]  ←── flex-grow ──→  [Hi, username] [Settings] [Sign out]
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dropdown, Avatar, Space, Drawer } from 'antd';
import type { MenuProps } from 'antd';
import {
  ImportOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { Session } from '@/types';

interface AppHeaderProps {
  session:          Session;
  onLogout:         () => void;
  onImportClick:    () => void;
  onManageFolders:  () => void;
}

export function AppHeader({
  session,
  onLogout,
  onImportClick,
  onManageFolders,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  /** Items for the mobile drawer menu */
  const mobileMenuItems: MenuProps['items'] = [
    {
      key:     'import',
      icon:    <ImportOutlined />,
      label:   'Import bookmarks',
      onClick: () => { setMobileDrawerOpen(false); onImportClick(); },
    },
    {
      key:     'folders',
      icon:    <FolderOpenOutlined />,
      label:   'Manage folders',
      onClick: () => { setMobileDrawerOpen(false); onManageFolders(); },
    },
    {
      key:     'settings',
      icon:    <SettingOutlined />,
      label:   'Settings',
      onClick: () => { setMobileDrawerOpen(false); navigate('/settings'); },
    },
    { type: 'divider' },
    {
      key:     'logout',
      icon:    <LogoutOutlined />,
      label:   'Sign out 🚪',
      danger:  true,
      onClick: () => { setMobileDrawerOpen(false); onLogout(); },
    },
  ];

  return (
    <header
      style={{
        position:        'sticky',
        top:             0,
        zIndex:          100,
        backgroundColor: '#003087',  // PrestoSports navy blue
        padding:         '0 16px',
        boxShadow:       '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* ── Mobile row ──────────────────────────────────────────────────────── */}
      <div
        className="header-mobile"
        style={{
          display:        'flex',
          alignItems:     'center',
          height:         52,
          gap:            12,
        }}
      >
        {/* Logo + wordmark */}
        <a
          href="/"
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 22 }}>🐦</span>
          <span
            style={{
              color:      '#ffffff',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize:   18,
              letterSpacing: '-0.3px',
            }}
          >
            PigeonSocial
          </span>
        </a>

        <div style={{ flex: 1 }} /> {/* pushes right side to the edge */}

        {/* Hi username — right side */}
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
          Hi, <strong style={{ color: '#fff' }}>{session.username}</strong>
        </span>

        {/* Hamburger button — mobile only */}
        <Button
          type="text"
          icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
          onClick={() => setMobileDrawerOpen(true)}
          className="header-hamburger"
          style={{ background: 'transparent', border: 'none' }}
        />
      </div>

      {/* ── Desktop second row ───────────────────────────────────────────────── */}
      <div
        className="header-desktop-actions"
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          paddingBottom:  10,
          borderTop:      '1px solid rgba(255,255,255,0.12)',
          paddingTop:     8,
        }}
      >
        <Button
          type="primary"
          ghost
          icon={<ImportOutlined />}
          onClick={onImportClick}
          style={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
        >
          Import
        </Button>

        <Button
          type="text"
          icon={<FolderOpenOutlined />}
          onClick={onManageFolders}
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          Folders
        </Button>

        <div style={{ flex: 1 }} />

        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Hi, <strong style={{ color: '#fff' }}>{session.username}</strong>
        </span>

        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={() => navigate('/settings')}
          style={{ color: 'rgba(255,255,255,0.8)' }}
          title="Settings"
        />

        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={onLogout}
          style={{ color: 'rgba(255,255,255,0.6)' }}
          title="Sign out"
        />
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800 }}>
            🐦 PigeonSocial
          </span>
        }
        placement="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={260}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {mobileMenuItems?.map((item) => {
            if (!item || item.type === 'divider') {
              return <hr key="divider" style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #f0f0f0' }} />;
            }

            const menuItem = item as { key: string; icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void };
            return (
              <Button
                key={menuItem.key}
                type="text"
                icon={menuItem.icon}
                onClick={menuItem.onClick}
                danger={menuItem.danger}
                style={{
                  width:       '100%',
                  textAlign:   'left',
                  height:      44,
                  borderRadius: 8,
                  display:     'flex',
                  alignItems:  'center',
                  gap:         8,
                }}
              >
                {menuItem.label}
              </Button>
            );
          })}
        </Space>
      </Drawer>
    </header>
  );
}
