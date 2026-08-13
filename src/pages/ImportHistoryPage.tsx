// src/pages/ImportHistoryPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Import history page — shows a log of every import session (one row per file).
// Accessible from the AppHeader "History" button via the /import-history route.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Button, Table, Tag, Tooltip, Typography, Empty, Popconfirm, Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  RestOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import db from '@/db/database';
import { SourceIcon } from '@/components/SourceIcon';
import { AppHeader } from '@/components/AppHeader';
import type { ImportSession, BookmarkSource, Session } from '@/types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportHistoryPageProps {
  session:  Session;
  onLogout: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportHistoryPage({ session, onLogout }: ImportHistoryPageProps) {
  const navigate = useNavigate();

  const sessions = useLiveQuery(
    () => db.importSessions.orderBy('importedAt').reverse().toArray(),
    [],
  ) ?? [];

  const columns: ColumnsType<ImportSession> = [
    {
      title:     'Imported',
      dataIndex: 'importedAt',
      key:       'importedAt',
      width:     140,
      render: (val: string) => (
        <Tooltip title={dayjs(val).format('MMM D, YYYY h:mm A')}>
          <Text style={{ fontSize: 13 }}>{dayjs(val).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title:     'File',
      dataIndex: 'fileName',
      key:       'fileName',
      render: (name: string) => (
        <Text style={{ fontSize: 13 }} ellipsis={{ tooltip: name }}>
          {name}
        </Text>
      ),
    },
    {
      title:  'Source',
      key:    'source',
      width:  90,
      render: (_, record) => {
        const src = record.detectedSource;
        const socialSources: BookmarkSource[] = ['twitter', 'instagram', 'youtube'];
        if (socialSources.includes(src as BookmarkSource)) {
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SourceIcon source={src as BookmarkSource} size={14} />
              <Text style={{ fontSize: 12, textTransform: 'capitalize' }}>{src}</Text>
            </span>
          );
        }
        if (src === 'pigeon-export') {
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RestOutlined style={{ fontSize: 13, color: '#003087' }} />
              <Text style={{ fontSize: 12 }}>Backup</Text>
            </span>
          );
        }
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WarningOutlined style={{ fontSize: 13, color: '#faad14' }} />
            <Text style={{ fontSize: 12 }}>Unknown</Text>
          </span>
        );
      },
    },
    {
      title:     'Added',
      dataIndex: 'addedCount',
      key:       'addedCount',
      width:     70,
      align:     'right',
      render: (n: number) => <Text style={{ fontSize: 13 }}>{n}</Text>,
    },
    {
      title:     'Updated',
      dataIndex: 'updatedCount',
      key:       'updatedCount',
      width:     80,
      align:     'right',
      render: (n: number) => <Text style={{ fontSize: 13 }}>{n}</Text>,
    },
    {
      title:  'Status',
      key:    'status',
      width:  80,
      align:  'center',
      render: (_, record) => {
        if (record.status === 'success') {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 12 }}>
              OK
            </Tag>
          );
        }
        if (record.status === 'failed') {
          return (
            <Tooltip title={record.errorMessage ?? 'Unknown error'}>
              <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 12, cursor: 'pointer' }}>
                Failed
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={record.errorMessage ?? ''}>
            <Tag icon={<WarningOutlined />} color="warning" style={{ fontSize: 12, cursor: 'pointer' }}>
              Partial
            </Tag>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#EEF3FA' }}>
      <AppHeader
        session={session}
        onLogout={onLogout}
        onImportClick={() => navigate('/')}
        onExportClick={() => navigate('/')}
        onManageFolders={() => navigate('/')}
      />

      <div style={{ padding: '20px 16px', maxWidth: 860, margin: '0 auto' }}>
        {/* Back button */}
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ marginBottom: 16, paddingLeft: 0 }}
        >
          Back to bookmarks
        </Button>

        <Title level={3} style={{ marginBottom: 4 }}>Import History</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          Every import session is recorded here. Clearing history does not affect your bookmarks.
        </Text>

        {sessions.length === 0 ? (
          <Empty
            description="No imports yet"
            style={{ marginTop: 60 }}
          >
            <Button type="primary" onClick={() => navigate('/')}>
              Import bookmarks
            </Button>
          </Empty>
        ) : (
          <>
            <Table<ImportSession>
              dataSource={sessions}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={sessions.length > 50 ? { pageSize: 50 } : false}
              style={{ backgroundColor: '#fff', borderRadius: 8 }}
            />

            <Space style={{ marginTop: 20 }}>
              <Popconfirm
                title="Clear all import history?"
                description="Bookmarks will not be affected."
                okText="Clear"
                okButtonProps={{ danger: true }}
                onConfirm={() => db.importSessions.clear()}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Clear history
                </Button>
              </Popconfirm>
            </Space>
          </>
        )}
      </div>
    </div>
  );
}
