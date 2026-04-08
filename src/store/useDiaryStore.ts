import { create } from 'zustand';
import type { DiaryMetadata, SearchResult } from '@/shared/models';

export type AuthState = 'checking' | 'setup' | 'locked' | 'unlocked';

interface EditorState {
  title: string;
  content: string;
  diaryId: string | null;
}

interface DiaryStore {
  authState: AuthState;
  statusText: string;
  diaries: DiaryMetadata[];
  selectedDiaryId: string | null;
  editor: EditorState;
  searchQuery: string;
  searchResults: SearchResult[];
  isLoadingDiary: boolean;
  isSaving: boolean;
  isDirty: boolean;
  setAuthState: (authState: AuthState) => void;
  setStatusText: (statusText: string) => void;
  setDiaries: (diaries: DiaryMetadata[]) => void;
  setSelectedDiaryId: (selectedDiaryId: string | null) => void;
  setEditor: (editor: Partial<EditorState>) => void;
  resetEditor: () => void;
  setSearchQuery: (searchQuery: string) => void;
  setSearchResults: (searchResults: SearchResult[]) => void;
  setLoadingDiary: (isLoadingDiary: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  markDirty: (isDirty: boolean) => void;
}

export const useDiaryStore = create<DiaryStore>((set) => ({
  authState: 'checking',
  statusText: '',
  diaries: [],
  selectedDiaryId: null,
  editor: {
    title: '',
    content: '',
    diaryId: null,
  },
  searchQuery: '',
  searchResults: [],
  isLoadingDiary: false,
  isSaving: false,
  isDirty: false,
  setAuthState: (authState) => set({ authState }),
  setStatusText: (statusText) => set({ statusText }),
  setDiaries: (diaries) => set({ diaries }),
  setSelectedDiaryId: (selectedDiaryId) => set({ selectedDiaryId }),
  setEditor: (editor) =>
    set((state) => ({
      editor: {
        ...state.editor,
        ...editor,
      },
    })),
  resetEditor: () =>
    set({
      editor: {
        title: '',
        content: '',
        diaryId: null,
      },
      selectedDiaryId: null,
      isDirty: false,
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setLoadingDiary: (isLoadingDiary) => set({ isLoadingDiary }),
  setSaving: (isSaving) => set({ isSaving }),
  markDirty: (isDirty) => set({ isDirty }),
}));
