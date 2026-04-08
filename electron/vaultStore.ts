import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { decryptText, deriveAesKey, derivePasswordHash, encryptText, generateSalt, verifyPassword as verifyPasswordHash } from '../src/shared/crypto';
import { LruCache } from '../src/shared/lruCache';
import { searchDiaries } from '../src/shared/search';
import type { BootstrapState, DiaryMetadata, DiaryRecord, SaveDiaryInput, SavedDiaryResult, SearchResult, VaultConfig } from '../src/shared/models';

interface StoredDiaryPayload {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface DiaryIndexFile {
  version: number;
  updatedAt: string;
  diaries: DiaryMetadata[];
}

const DEFAULT_ITERATIONS = 200000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

type LockListener = (reason: BootstrapState['lockedReason']) => void;

function sortByNewest(diaries: DiaryMetadata[]): DiaryMetadata[] {
  return [...diaries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function toDiaryMetadata(record: DiaryRecord): DiaryMetadata {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    fileName: record.fileName,
  };
}

export class VaultStore {
  private readonly dataDir: string;
  private readonly diariesDir: string;
  private readonly configPath: string;
  private readonly indexPath: string;

  private config: VaultConfig | null = null;
  private index: DiaryMetadata[] = [];
  private encryptionKey: Buffer | null = null;
  private readonly contentCache = new LruCache<string, DiaryRecord>(100);
  private readonly lockListeners = new Set<LockListener>();
  private idleTimer: NodeJS.Timeout | null = null;
  private lockReason: BootstrapState['lockedReason'] = 'none';

  public constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.diariesDir = path.join(this.dataDir, 'diaries');
    this.configPath = path.join(this.dataDir, 'config.json');
    this.indexPath = path.join(this.dataDir, 'index.json');
  }

  public async initialize(): Promise<BootstrapState> {
    try {
      await mkdir(this.diariesDir, { recursive: true });
      await this.loadConfig();
      await this.loadIndex();
      return this.bootstrapState();
    } catch (error) {
      throw this.wrapError('Failed to initialize vault storage', error);
    }
  }

  public async bootstrapState(): Promise<BootstrapState> {
    try {
      return {
        hasVault: this.config !== null,
        unlocked: this.encryptionKey !== null,
        diaryCount: this.index.length,
        lockedReason: this.lockReason,
      };
    } catch (error) {
      throw this.wrapError('Failed to build bootstrap state', error);
    }
  }

  public async setupVault(password: string): Promise<void> {
    try {
      if (this.config !== null) {
        throw new Error('Vault already exists.');
      }

      const authSalt = generateSalt();
      let encSalt = generateSalt();
      while (encSalt === authSalt) {
        encSalt = generateSalt();
      }

      const config: VaultConfig = {
        passwordHash: await derivePasswordHash(password, authSalt, DEFAULT_ITERATIONS),
        authSalt,
        encSalt,
        pbkdf2Iterations: DEFAULT_ITERATIONS,
      };

      await this.persistConfig(config);
      this.config = config;
      this.index = [];
      await this.persistIndex();
      await this.unlockWithPassword(password);
    } catch (error) {
      throw this.wrapError('Failed to set up vault', error);
    }
  }

  public async verifyPassword(password: string): Promise<void> {
    try {
      if (this.config === null) {
        throw new Error('Vault is not initialized.');
      }

      const ok = await verifyPasswordHash(password, this.config);
      if (!ok) {
        throw new Error('Incorrect password.');
      }

      await this.unlockWithPassword(password);
    } catch (error) {
      throw this.wrapError('Failed to verify password', error);
    }
  }

  public async lock(reason: BootstrapState['lockedReason'] = 'manual'): Promise<void> {
    try {
      if (this.encryptionKey !== null) {
        this.encryptionKey.fill(0);
        this.encryptionKey = null;
      }

      this.contentCache.clear();
      this.clearIdleTimer();
      this.lockReason = reason;
      this.notifyLocked(reason);
    } catch (error) {
      throw this.wrapError('Failed to lock vault', error);
    }
  }

  public async listDiaries(): Promise<DiaryMetadata[]> {
    try {
      this.requireUnlocked();
      this.touchActivity();
      return sortByNewest(this.index);
    } catch (error) {
      throw this.wrapError('Failed to list diaries', error);
    }
  }

  public onLock(listener: LockListener): () => void {
    this.lockListeners.add(listener);
    return () => {
      this.lockListeners.delete(listener);
    };
  }

  public async loadDiaryContent(id: string): Promise<DiaryRecord | null> {
    try {
      this.requireUnlocked();
      this.touchActivity();

      const cached = this.contentCache.get(id);
      if (cached) {
        return cached;
      }

      const metadata = this.index.find((item) => item.id === id);
      if (!metadata) {
        return null;
      }

      const record = await this.readDiaryFile(metadata);
      this.contentCache.set(id, record);
      return record;
    } catch (error) {
      throw this.wrapError('Failed to load diary content', error);
    }
  }

  public async saveDiaryContent(input: SaveDiaryInput): Promise<SavedDiaryResult> {
    try {
      this.requireUnlocked();
      this.touchActivity();

      const id = input.id?.trim() || randomUUID();
      const title = this.normalizeTitle(input.title);
      const existing = this.index.find((item) => item.id === id);
      const now = new Date().toISOString();
      const createdAt = existing?.createdAt ?? now;
      const diary: DiaryRecord = {
        id,
        title,
        content: input.content,
        createdAt,
        updatedAt: now,
        fileName: `${id}.enc`,
      };

      await this.writeDiaryFile(diary);
      this.index = sortByNewest([
        ...this.index.filter((item) => item.id !== id),
        toDiaryMetadata(diary),
      ]);
      await this.persistIndex();
      this.contentCache.set(id, diary);

      return {
        diary,
        created: existing === undefined,
      };
    } catch (error) {
      throw this.wrapError('Failed to save diary content', error);
    }
  }

  public async searchDiaries(query: string): Promise<SearchResult[]> {
    try {
      this.requireUnlocked();
      this.touchActivity();

      if (!query.trim()) {
        return this.index.map((record) => ({
          ...record,
          snippet: '',
          score: 0,
        }));
      }

      const records: DiaryRecord[] = [];
      for (const metadata of this.index) {
        const cached = this.contentCache.get(metadata.id);
        if (cached) {
          records.push(cached);
          continue;
        }

        const loaded = await this.readDiaryFile(metadata);
        this.contentCache.set(metadata.id, loaded);
        records.push(loaded);
      }

      return searchDiaries(records, query);
    } catch (error) {
      throw this.wrapError('Failed to search diaries', error);
    }
  }

  private async unlockWithPassword(password: string): Promise<void> {
    if (this.config === null) {
      throw new Error('Vault is not initialized.');
    }

    this.encryptionKey = await deriveAesKey(password, this.config.encSalt, this.config.pbkdf2Iterations);
    this.lockReason = 'none';
    this.resetIdleTimer();
  }

  private requireUnlocked(): void {
    if (this.encryptionKey === null) {
      throw new Error('Vault is locked.');
    }
  }

  private normalizeTitle(title: string): string {
    const cleanTitle = title.trim();
    if (cleanTitle.length > 0) {
      return cleanTitle;
    }

    return 'Untitled';
  }

  private async loadConfig(): Promise<void> {
    try {
      const raw = await readFile(this.configPath, 'utf8');
      this.config = JSON.parse(raw) as VaultConfig;
    } catch (error) {
      this.config = null;
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('ENOENT')) {
        throw error;
      }
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const raw = await readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as DiaryIndexFile;
      this.index = sortByNewest(parsed.diaries ?? []);
    } catch (error) {
      this.index = [];
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('ENOENT')) {
        throw error;
      }
    }
  }

  private async persistConfig(config: VaultConfig): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  private async persistIndex(): Promise<void> {
    const payload: DiaryIndexFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      diaries: sortByNewest(this.index),
    };

    await writeFile(this.indexPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  private async readDiaryFile(metadata: DiaryMetadata): Promise<DiaryRecord> {
    if (this.encryptionKey === null) {
      throw new Error('Vault is locked.');
    }

    const raw = await readFile(path.join(this.diariesDir, metadata.fileName), 'utf8');
    const envelope = JSON.parse(raw) as { payload: ReturnType<typeof encryptText> };
    const decrypted = decryptText(envelope.payload, this.encryptionKey);
    const parsed = JSON.parse(decrypted) as StoredDiaryPayload;

    return {
      id: parsed.id,
      title: parsed.title,
      content: parsed.content,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      fileName: metadata.fileName,
    };
  }

  private async writeDiaryFile(diary: DiaryRecord): Promise<void> {
    if (this.encryptionKey === null) {
      throw new Error('Vault is locked.');
    }

    await mkdir(this.diariesDir, { recursive: true });
    const payload: StoredDiaryPayload = {
      id: diary.id,
      title: diary.title,
      content: diary.content,
      createdAt: diary.createdAt,
      updatedAt: diary.updatedAt,
    };

    const envelope = {
      payload: encryptText(JSON.stringify(payload), this.encryptionKey),
    };

    await writeFile(path.join(this.diariesDir, diary.fileName), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      void this.lock('idle');
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private touchActivity(): void {
    if (this.encryptionKey !== null) {
      this.resetIdleTimer();
    }
  }

  private notifyLocked(reason: BootstrapState['lockedReason']): void {
    for (const listener of this.lockListeners) {
      try {
        listener(reason);
      } catch (error) {
        console.error('Failed to notify lock listener', error);
      }
    }
  }

  private wrapError(message: string, error: unknown): Error {
    if (error instanceof Error) {
      return new Error(`${message}: ${error.message}`);
    }

    return new Error(message);
  }
}
