import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Alert, Button, Card, ConfigProvider, Empty, Input, Layout, List, Space, Spin, Typography, type InputRef } from 'antd';
import { LockOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import { useDiaryStore } from '@/store/useDiaryStore';
import type { BootstrapState, DiaryMetadata, SearchResult } from '@/shared/models';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const AUTOSAVE_DELAY_MS = 1000;
const SEARCH_DELAY_MS = 250;

function getDisplayTitle(title: string): string {
  return title.trim() || 'Untitled';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isEmptyEditor(title: string, content: string): boolean {
  return title.trim().length === 0 && content.trim().length === 0;
}

function activateOnKeyboard(event: KeyboardEvent<HTMLDivElement>, onClick: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onClick();
  }
}

function getLockStatus(reason: BootstrapState['lockedReason']): string {
  switch (reason) {
    case 'idle':
      return '已因 5 分钟无操作自动锁定。';
    case 'manual':
      return '保险库已锁定。';
    case 'close':
      return '应用已关闭。';
    default:
      return '保险库处于锁定状态。';
  }
}

function getWorkspaceMessage(reason: BootstrapState['lockedReason']): string {
  switch (reason) {
    case 'idle':
      return '保险库已因 5 分钟无操作自动锁定。';
    case 'manual':
      return '保险库已锁定，请重新输入主密码。';
    case 'close':
      return '应用已关闭。';
    default:
      return '请选择一篇日记，或新建一篇。';
  }
}

function DiaryListItem({ diary, active, onClick }: { diary: DiaryMetadata; active: boolean; onClick: () => void }) {
  return (
    <div
      className={`diary-item ${active ? 'active' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => activateOnKeyboard(event, onClick)}
      role="button"
      tabIndex={0}
    >
      <Text strong>{getDisplayTitle(diary.title)}</Text>
      <Text type="secondary" className="diary-item-meta">
        {formatDate(diary.updatedAt)}
      </Text>
    </div>
  );
}

function SearchListItem({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  return (
    <div
      className="search-item"
      onClick={onClick}
      onKeyDown={(event) => activateOnKeyboard(event, onClick)}
      role="button"
      tabIndex={0}
    >
      <Text strong>{getDisplayTitle(result.title)}</Text>
      <Text type="secondary" className="diary-item-meta">
        {formatDate(result.updatedAt)}
      </Text>
      <Paragraph ellipsis={{ rows: 2, tooltip: result.snippet }} className="search-item-snippet">
        {result.snippet || ' '}
      </Paragraph>
    </div>
  );
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const authState = useDiaryStore((state) => state.authState);
  const statusText = useDiaryStore((state) => state.statusText);
  const setAuthState = useDiaryStore((state) => state.setAuthState);
  const setStatusText = useDiaryStore((state) => state.setStatusText);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setError('');
  }, [authState]);

  const handleSubmit = async () => {
    const isSetup = authState === 'setup';
    let unlocked = false;

    try {
      setBusy(true);
      setError('');

      if (!password.trim()) {
        throw new Error('主密码不能为空。');
      }

      if (isSetup && password !== confirmPassword) {
        throw new Error('两次输入的主密码不一致。');
      }

      if (isSetup) {
        await window.diaryApi.setupVault(password);
      } else {
        await window.diaryApi.verifyPassword(password);
      }

      unlocked = true;
      await onAuthenticated();
      setAuthState('unlocked');
      setStatusText(isSetup ? '保险库已创建并解锁。' : '保险库已解锁。');
    } catch (submitError) {
      if (unlocked) {
        try {
          await window.diaryApi.lockVault();
        } catch {
          // Keep the original error visible.
        }
      }

      setError(submitError instanceof Error ? submitError.message : '认证失败。');
    } finally {
      setBusy(false);
    }
  };

  if (authState === 'checking') {
    return (
      <div className="auth-screen">
        <Spin size="large" />
        <Text type="secondary">正在检查本地保险库状态...</Text>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <Card className="auth-card">
        <Title level={2}>{authState === 'setup' ? '创建主密码' : '解锁保险库'}</Title>
        <Paragraph type="secondary">
          {authState === 'setup'
            ? '首次使用需要设置主密码。系统会用它派生 AES-256-GCM 密钥来保护本地日记。'
            : '输入主密码以解锁本地加密日记。'}
        </Paragraph>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.Password
            value={password}
            placeholder="主密码"
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={() => void handleSubmit()}
          />
          {authState === 'setup' ? (
            <Input.Password
              value={confirmPassword}
              placeholder="确认主密码"
              onChange={(event) => setConfirmPassword(event.target.value)}
              onPressEnter={() => void handleSubmit()}
            />
          ) : null}
          <Button type="primary" onClick={() => void handleSubmit()} loading={busy}>
            {authState === 'setup' ? '创建保险库' : '解锁'}
          </Button>
          {error ? <Alert type="error" message={error} showIcon /> : null}
          {!error && statusText ? <Alert type="info" message={statusText} showIcon /> : null}
        </Space>
      </Card>
    </div>
  );
}

function DiaryWorkspace() {
  const diaries = useDiaryStore((state) => state.diaries);
  const selectedDiaryId = useDiaryStore((state) => state.selectedDiaryId);
  const editor = useDiaryStore((state) => state.editor);
  const searchQuery = useDiaryStore((state) => state.searchQuery);
  const searchResults = useDiaryStore((state) => state.searchResults);
  const isLoadingDiary = useDiaryStore((state) => state.isLoadingDiary);
  const isSaving = useDiaryStore((state) => state.isSaving);
  const isDirty = useDiaryStore((state) => state.isDirty);
  const statusText = useDiaryStore((state) => state.statusText);
  const setAuthState = useDiaryStore((state) => state.setAuthState);
  const setDiaries = useDiaryStore((state) => state.setDiaries);
  const setSelectedDiaryId = useDiaryStore((state) => state.setSelectedDiaryId);
  const setEditor = useDiaryStore((state) => state.setEditor);
  const setStatusText = useDiaryStore((state) => state.setStatusText);
  const setSearchQuery = useDiaryStore((state) => state.setSearchQuery);
  const setSearchResults = useDiaryStore((state) => state.setSearchResults);
  const setLoadingDiary = useDiaryStore((state) => state.setLoadingDiary);
  const setSaving = useDiaryStore((state) => state.setSaving);
  const markDirty = useDiaryStore((state) => state.markDirty);
  const resetEditor = useDiaryStore((state) => state.resetEditor);
  const searchInputRef = useRef<InputRef>(null);
  const titleInputRef = useRef<InputRef>(null);
  const [loadingMessage, setLoadingMessage] = useState('请选择一篇日记，或新建一篇。');

  const refreshDiaryList = async (): Promise<DiaryMetadata[]> => {
    try {
      const nextDiaries = await window.diaryApi.listDiaries();
      setDiaries(nextDiaries);
      setSearchResults(await window.diaryApi.searchDiaries(searchQuery));

      if (nextDiaries.length === 0 && editor.diaryId === null) {
        setLoadingMessage('当前还没有日记，点击“新建”开始写作。');
      }

      return nextDiaries;
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '刷新日记列表失败。');
      return diaries;
    }
  };

  const loadDiary = async (id: string | null): Promise<void> => {
    try {
      setLoadingDiary(true);
      setStatusText('');

      if (id === null) {
        setSelectedDiaryId(null);
        resetEditor();
        setLoadingMessage('新建草稿已准备好。');
        return;
      }

      const diary = await window.diaryApi.loadDiaryContent(id);
      if (!diary) {
        setSelectedDiaryId(null);
        resetEditor();
        setLoadingMessage('未找到该日记。');
        return;
      }

      setSelectedDiaryId(diary.id);
      setEditor({
        diaryId: diary.id,
        title: diary.title,
        content: diary.content,
      });
      markDirty(false);
      setLoadingMessage(`正在编辑：${getDisplayTitle(diary.title)}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '加载日记失败。');
    } finally {
      setLoadingDiary(false);
    }
  };

  const saveCurrent = async (): Promise<void> => {
    try {
      if (isEmptyEditor(editor.title, editor.content) && editor.diaryId === null) {
        return;
      }

      setSaving(true);
      const saved = await window.diaryApi.saveDiaryContent({
        id: editor.diaryId,
        title: editor.title,
        content: editor.content,
      });

      setDiaries(saved.diaries);
      setSelectedDiaryId(saved.diary.id);
      setEditor({
        diaryId: saved.diary.id,
        title: saved.diary.title,
        content: saved.diary.content,
      });
      markDirty(false);
      setLoadingMessage(saved.created ? '已创建新的加密日记。' : '当前日记已保存。');
      setStatusText(saved.created ? '已创建并保存日记。' : '日记已保存。');
      setSearchResults(await window.diaryApi.searchDiaries(searchQuery));
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '保存日记失败。');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (isDirty && !isLoadingDiary && !isSaving && !cancelled) {
        void saveCurrent();
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editor.title, editor.content, isDirty, isLoadingDiary, isSaving]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await window.diaryApi.searchDiaries(searchQuery);
          if (!cancelled) {
            setSearchResults(results);
          }
        } catch (error) {
          if (!cancelled) {
            setStatusText(error instanceof Error ? error.message : '搜索失败。');
          }
        }
      })();
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const unsubscribe = window.diaryApi.onVaultLocked((reason) => {
      setAuthState('locked');
      setStatusText(getLockStatus(reason));
      setDiaries([]);
      setSearchQuery('');
      setSearchResults([]);
      resetEditor();
      setLoadingMessage(getWorkspaceMessage(reason));
    });

    return unsubscribe;
  }, [resetEditor, setAuthState, setDiaries, setSearchQuery, setSearchResults, setStatusText]);

  useEffect(() => {
    const unsubscribe = window.diaryApi.onMenuAction((action) => {
      switch (action) {
        case 'new-diary':
          void loadDiary(null);
          break;
        case 'save-diary':
          void saveCurrent();
          break;
        case 'lock-vault':
          void window.diaryApi.lockVault();
          break;
        case 'refresh-diaries':
          void refreshDiaryList();
          break;
        case 'focus-search':
          searchInputRef.current?.focus();
          break;
        case 'focus-editor':
          titleInputRef.current?.focus();
          break;
      }
    });

    return unsubscribe;
  }, [searchInputRef, titleInputRef, searchQuery, editor.title, editor.content, editor.diaryId, isDirty, isLoadingDiary, isSaving]);

  return (
    <Layout className="workspace">
      <Header className="topbar">
        <div>
          <Title level={3} className="app-title">
            加密日记
          </Title>
          <Text type="secondary">仅本地存储 | AES-256-GCM | 密钥只保留在主进程内存中</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refreshDiaryList()}>
            刷新
          </Button>
          <Button icon={<LockOutlined />} onClick={() => void window.diaryApi.lockVault()}>
            锁定
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void loadDiary(null)}>
            新建
          </Button>
        </Space>
      </Header>
      <Layout className="workspace-shell">
        <Sider width={320} className="pane pane-left" theme="light">
          <div className="pane-header">
            <Title level={4}>日记列表</Title>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="搜索标题或内容"
              allowClear
            />
          </div>
          <List
            className="diary-list"
            dataSource={diaries}
            locale={{ emptyText: '当前还没有日记。' }}
            renderItem={(item) => (
              <List.Item className="diary-list-row">
                <DiaryListItem
                  diary={item}
                  active={selectedDiaryId === item.id}
                  onClick={() => void loadDiary(item.id)}
                />
              </List.Item>
            )}
          />
        </Sider>
        <Content className="pane pane-editor">
          <Card className="editor-card">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Input
                ref={titleInputRef}
                size="large"
                value={editor.title}
                placeholder="标题"
                onChange={(event) => {
                  setEditor({ title: event.target.value });
                  markDirty(true);
                }}
              />
              <Input.TextArea
                value={editor.content}
                placeholder="在这里写下今天的记录..."
                autoSize={{ minRows: 22, maxRows: 28 }}
                onChange={(event) => {
                  setEditor({ content: event.target.value });
                  markDirty(true);
                }}
              />
              <Space wrap>
                <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={() => void saveCurrent()}>
                  立即保存
                </Button>
                <Text type="secondary">{isDirty ? '有未保存修改' : '当前内容已保存'}</Text>
                <Text type="secondary">{isLoadingDiary ? '正在加载日记...' : loadingMessage}</Text>
              </Space>
              {statusText ? <Alert message={statusText} type="info" showIcon /> : null}
            </Space>
          </Card>
        </Content>
        <Sider width={360} className="pane pane-right" theme="light">
          <div className="pane-header">
            <Title level={4}>搜索结果</Title>
            <Text type="secondary">加密内容会在主进程内解密后搜索，并缓存最多 100 篇日记。</Text>
          </div>
          {searchResults.length > 0 ? (
            <List
              className="search-list"
              dataSource={searchResults}
              renderItem={(item) => (
                <List.Item className="search-list-row">
                  <SearchListItem result={item} onClick={() => void loadDiary(item.id)} />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无匹配结果。" />
          )}
        </Sider>
      </Layout>
    </Layout>
  );
}

function AppContent() {
  const authState = useDiaryStore((state) => state.authState);
  const setAuthState = useDiaryStore((state) => state.setAuthState);
  const setStatusText = useDiaryStore((state) => state.setStatusText);
  const setDiaries = useDiaryStore((state) => state.setDiaries);
  const setSelectedDiaryId = useDiaryStore((state) => state.setSelectedDiaryId);
  const setSearchQuery = useDiaryStore((state) => state.setSearchQuery);
  const setSearchResults = useDiaryStore((state) => state.setSearchResults);
  const resetEditor = useDiaryStore((state) => state.resetEditor);

  const bootstrapUnlocked = async (): Promise<void> => {
    const diaries = await window.diaryApi.listDiaries();
    setDiaries(diaries);
    setSearchQuery('');
    setSearchResults(await window.diaryApi.searchDiaries(''));

    if (diaries.length > 0) {
      const diary = await window.diaryApi.loadDiaryContent(diaries[0].id);
      if (diary) {
        useDiaryStore.setState({
          selectedDiaryId: diary.id,
          editor: {
            diaryId: diary.id,
            title: diary.title,
            content: diary.content,
          },
          isDirty: false,
        });
        return;
      }
    }

    setSelectedDiaryId(null);
    resetEditor();
  };

  useEffect(() => {
    void (async () => {
      try {
        const state = await window.diaryApi.getBootstrapState();
        if (!state.hasVault) {
          setAuthState('setup');
          return;
        }

        if (state.unlocked) {
          await bootstrapUnlocked();
          setAuthState('unlocked');
          setStatusText('保险库已准备就绪。');
          return;
        }

        setAuthState('locked');
        if (state.lockedReason !== 'none') {
          setStatusText(getLockStatus(state.lockedReason));
        }
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : '应用启动失败。');
        setAuthState('locked');
      }
    })();
  }, []);

  if (authState === 'unlocked') {
    return <DiaryWorkspace />;
  }

  return <AuthPanel onAuthenticated={bootstrapUnlocked} />;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0f766e',
          borderRadius: 14,
          fontSize: 14,
          colorBgBase: '#0b1220',
          colorTextBase: '#e5eef8',
        },
      }}
    >
      <AppContent />
    </ConfigProvider>
  );
}
