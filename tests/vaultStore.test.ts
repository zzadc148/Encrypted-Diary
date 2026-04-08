import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { VaultStore } from '../electron/vaultStore';

describe('VaultStore', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.useRealTimers();

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('creates, encrypts, loads, and searches diaries', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'encrypted-diary-'));
    tempDirs.push(dir);

    const store = new VaultStore(dir);
    await store.initialize();
    await store.setupVault('abc12345');

    const saved = await store.saveDiaryContent({
      title: 'My First Note',
      content: 'This is a private diary entry about solar energy and a hidden plan.',
    });

    const raw = await readFile(path.join(dir, 'diaries', `${saved.diary.id}.enc`), 'utf8');
    expect(raw).toContain('authTag');
    expect(raw).not.toContain('private diary entry');

    const loaded = await store.loadDiaryContent(saved.diary.id);
    expect(loaded?.content).toContain('solar energy');
    expect(loaded?.title).toBe('My First Note');

    const results = await store.searchDiaries('solar');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(saved.diary.id);

    await store.lock();
    await expect(store.loadDiaryContent(saved.diary.id)).rejects.toThrow('Vault is locked.');
  });

  it('handles empty search and long content', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'encrypted-diary-'));
    tempDirs.push(dir);

    const store = new VaultStore(dir);
    await store.initialize();
    await store.setupVault('long-content-pass');

    await store.saveDiaryContent({
      title: '',
      content: 'x'.repeat(5000),
    });

    const all = await store.searchDiaries('');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Untitled');
  });

  it('locks itself after five minutes of inactivity', async () => {
    vi.useFakeTimers();

    const dir = await mkdtemp(path.join(os.tmpdir(), 'encrypted-diary-'));
    tempDirs.push(dir);

    const store = new VaultStore(dir);
    await store.initialize();
    await store.setupVault('idle-pass');

    expect((await store.bootstrapState()).unlocked).toBe(true);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    const state = await store.bootstrapState();
    expect(state.unlocked).toBe(false);
    expect(state.lockedReason).toBe('idle');
  });
});
