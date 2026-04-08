export interface VaultConfig {
  passwordHash: string;
  authSalt: string;
  encSalt: string;
  pbkdf2Iterations: number;
}

export interface DiaryMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  fileName: string;
}

export interface DiaryRecord extends DiaryMetadata {
  content: string;
}

export interface SearchResult extends DiaryMetadata {
  snippet: string;
  score: number;
}

export interface BootstrapState {
  hasVault: boolean;
  unlocked: boolean;
  diaryCount: number;
  lockedReason: 'none' | 'manual' | 'idle' | 'close';
}

export interface SaveDiaryInput {
  id?: string | null;
  title: string;
  content: string;
}

export interface SavedDiaryResult {
  diary: DiaryRecord;
  created: boolean;
}

export type MenuAction =
  | 'new-diary'
  | 'save-diary'
  | 'lock-vault'
  | 'refresh-diaries'
  | 'focus-search'
  | 'focus-editor';
