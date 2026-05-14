// src/pages/SettingsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// System settings page, accessible from the header.
// All toggles update the Zustand settings store which persists to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom';
import {
  Switch, Radio, Divider, Button, Card, Space, Typography, Alert
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store/useAppStore';
import { SourceIcon } from '@/components/SourceIcon';

const { Title, Text } = Typography;

export function SettingsPage() {
  const navigate = useNavigate();

  // Pull settings and the updater from the store
  const settings       = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <div
      style={{
        minHeight:       '100vh',
        backgroundColor: '#EEF3FA',
        padding:         '20px 16px',
      }}
    >
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        Back to bookmarks
      </Button>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Title level={2} style={{ color: '#003087', fontFamily: 'Nunito, sans-serif', marginTop: 0 }}>
          🐦 Settings
        </Title>

        {/* ── Sources ─────────────────────────────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>Visible Sources</Title>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
            Turn off a source to hide all its bookmarks from the feed. The bookmarks are not deleted.
          </Text>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <SettingsRow
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SourceIcon source="twitter" size={16} /> Twitter / X
                </span>
              }
              checked={settings.showTwitter}
              onChange={(checked) => updateSettings({ showTwitter: checked })}
            />
            <SettingsRow
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SourceIcon source="instagram" size={16} /> Instagram
                </span>
              }
              checked={settings.showInstagram}
              onChange={(checked) => updateSettings({ showInstagram: checked })}
            />
            <SettingsRow
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SourceIcon source="youtube" size={16} /> YouTube
                </span>
              }
              checked={settings.showYoutube}
              onChange={(checked) => updateSettings({ showYoutube: checked })}
            />
          </Space>
        </Card>

        {/* ── Display ─────────────────────────────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>Display</Title>

          <SettingsRow
            label="Show thumbnail previews"
            description="Loads and displays the thumbnail image on each card. Turn off to save bandwidth or for a denser view."
            checked={settings.showPreviews}
            onChange={(checked) => updateSettings({ showPreviews: checked })}
          />

          <Divider style={{ margin: '16px 0' }} />

          <div>
            <p style={{ margin: '0 0 10px', fontWeight: 500 }}>Theme</p>
            <Radio.Group
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value })}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="light">Light</Radio.Button>
              <Radio.Button value="dark">Dark</Radio.Button>
              <Radio.Button value="system">System</Radio.Button>
            </Radio.Group>
            <Alert
              type="info"
              message="Dark mode applies to the app shell. Full dark theme support is a work in progress."
              showIcon
              style={{ marginTop: 12, borderRadius: 8, fontSize: 12 }}
            />
          </div>
        </Card>

        {/* ── Data ────────────────────────────────────────────────────────── */}
        <Card style={{ borderRadius: 12 }}>
          <Title level={5} style={{ marginTop: 0 }}>Data</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            All bookmarks and folders are stored locally in your browser's IndexedDB.
            Clearing your browser data will remove them.
          </Text>
        </Card>
      </div>
    </div>
  );
}

// ── Helper component for a labelled toggle row ────────────────────────────────

interface SettingsRowProps {
  label:       React.ReactNode;
  description?: string;
  checked:     boolean;
  onChange:    (checked: boolean) => void;
}

function SettingsRow({ label, description, checked, onChange }: SettingsRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        {description && (
          <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>{description}</div>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
    </div>
  );
}
