import type { BootstrapState, DiaryMetadata, DiaryRecord, MenuAction, SavedDiaryResult, SearchResult } from './models';

export interface DiaryApi {
  getBootstrapState(): Promise<BootstrapState>;
  setupVault(password: string): Promise<BootstrapState>;
  verifyPassword(password: string): Promise<BootstrapState>;
  lockVault(): Promise<BootstrapState>;
  listDiaries(): Promise<DiaryMetadata[]>;
  loadDiaryContent(id: string): Promise<DiaryRecord | null>;
  saveDiaryContent(input: { id?: string | null; title: string; content: string }): Promise<SavedDiaryResult & { diaries: DiaryMetadata[] }>;
  searchDiaries(query: string): Promise<SearchResult[]>;
  onVaultLocked(callback: (reason: BootstrapState['lockedReason']) => void): () => void;
  onMenuAction(callback: (action: MenuAction) => void): () => void;
}
