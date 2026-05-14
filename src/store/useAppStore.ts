// src/store/useAppStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Zustand global store for UI state that needs to be shared across components.
//
// Zustand is a minimal React state manager. Unlike Redux, there's no boilerplate —
// just a `create()` call with your state + actions all in one object.
//
// What lives here:
//   • AppSettings (persisted to localStorage)
//   • FilterState (in-memory, resets on page refresh)
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, FilterState, BookmarkSource } from '@/types';

// ── Default values ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  showTwitter:   true,
  showInstagram: true,
  showYoutube:   true,
  showPreviews:  true,
  theme:         'system',
};

const DEFAULT_FILTER: FilterState = {
  searchQuery:    '',
  activeSources:  [],       // empty = all sources visible
  activeFolderId: null,     // null = all folders visible
};

// ── Store shape ───────────────────────────────────────────────────────────────

interface AppStore {
  // Settings (admin-controlled, persisted to localStorage)
  settings: AppSettings;
  updateSettings: (partialSettings: Partial<AppSettings>) => void;

  // Filter state (user-controlled, in-memory only)
  filter: FilterState;
  setSearchQuery:   (query: string) => void;
  toggleSourceFilter: (source: BookmarkSource) => void;
  setActiveFolderId: (folderId: string | null | 'uncategorized') => void;
  clearAllFilters:  () => void;
}

// ── Store creation ────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  // `persist` middleware automatically saves/restores the settings slice
  // to/from localStorage. The filter slice is excluded (in-memory only).
  persist(
    (set) => ({
      // ── Settings ───────────────────────────────────────────────────────────
      settings: DEFAULT_SETTINGS,

      updateSettings: (partialSettings) =>
        set((currentState) => ({
          settings: { ...currentState.settings, ...partialSettings },
        })),

      // ── Filters ────────────────────────────────────────────────────────────
      filter: DEFAULT_FILTER,

      setSearchQuery: (newQuery) =>
        set((currentState) => ({
          filter: { ...currentState.filter, searchQuery: newQuery },
        })),

      toggleSourceFilter: (sourceToToggle) =>
        set((currentState) => {
          const currentActiveSources = currentState.filter.activeSources;
          const isAlreadyActive      = currentActiveSources.includes(sourceToToggle);

          return {
            filter: {
              ...currentState.filter,
              activeSources: isAlreadyActive
                // Remove the source from active filters
                ? currentActiveSources.filter((s) => s !== sourceToToggle)
                // Add the source to active filters
                : [...currentActiveSources, sourceToToggle],
            },
          };
        }),

      setActiveFolderId: (newFolderId) =>
        set((currentState) => ({
          filter: { ...currentState.filter, activeFolderId: newFolderId },
        })),

      clearAllFilters: () =>
        set({ filter: DEFAULT_FILTER }),
    }),
    {
      name: 'pigeon_settings',
      // Only persist the settings slice, not the in-memory filter state
      partialize: (storeState) => ({ settings: storeState.settings }),
    }
  )
);

// ── Derived selectors ─────────────────────────────────────────────────────────
// These live outside the store to keep the store definition focused.

/**
 * Returns true if any filter is currently active (i.e. the view is narrowed).
 * Used to show a "Clear filters" button.
 */
export function selectIsFiltered(storeState: AppStore): boolean {
  const { searchQuery, activeSources, activeFolderId } = storeState.filter;
  return (
    searchQuery !== '' ||
    activeSources.length > 0 ||
    activeFolderId !== null
  );
}
