import type { DiaryApi } from '../shared/api';

declare global {
  interface Window {
    diaryApi: DiaryApi;
  }
}

export {};
