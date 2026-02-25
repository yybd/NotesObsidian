// notesStore.ts - Zustand store for managing app state

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, AppSettings, ObsidianVaultConfig, DomainType } from '../types/Note';
import FileService from '../services/FileService';
import ObsidianService from '../services/ObsidianService';
import SearchService from '../services/SearchService';
import StorageService from '../services/StorageService';
import { updateFrontmatter, removeFrontmatterKey } from '../services/FrontmatterService';

interface NotesStore {
    // State
    notes: Note[];
    filteredNotes: Note[];
    searchQuery: string;
    selectedTag: string | null;
    currentDomain: DomainType | null;
    settings: AppSettings;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadNotes: () => Promise<void>;
    createNote: (title: string, content: string) => Promise<Note>;
    updateNote: (id: string, filePath: string, content: string) => Promise<Note>;
    deleteNote: (filePath: string) => Promise<void>;
    archiveNote: (filePath: string) => Promise<void>;
    togglePinNote: (noteId: string, currentContent?: string) => Promise<void>;
    searchNotes: (query: string) => void;
    filterByTag: (tag: string | null) => void;
    filterByDomain: (domain: DomainType | null) => void;
    syncToObsidian: (note: Note) => Promise<void>;
    importFromObsidian: (uri: string) => Promise<void>;
    updateSettings: (settings: Partial<AppSettings>) => void;
    setVaultConfig: (config: ObsidianVaultConfig) => void;
}

const defaultSettings: AppSettings = {
    vault: null,
    autoSync: false,
    syncInterval: 15,
    theme: 'auto',
    defaultView: 'grid',
};

export const useNotesStore = create<NotesStore>()(
    persist(
        (set, get) => ({
            // Initial state
            notes: [],
            filteredNotes: [],
            searchQuery: '',
            selectedTag: null,
            currentDomain: null,
            settings: defaultSettings,
            isLoading: false,
            error: null,

            // Load all notes from file system (Local or External via StorageService)
            loadNotes: async () => {
                set({ isLoading: true, error: null });
                try {
                    // Ensure StorageService has the correct config from persisted state
                    const currentSettings = get().settings;
                    if (currentSettings.vault) {
                        StorageService.setConfig(currentSettings.vault);
                    }

                    // Pass current notes to listNotes as cache
                    const currentNotes = get().notes;
                    const notes = await StorageService.listNotes(currentNotes);
                    // Sort: pinned first (by updatedAt), then unpinned (by updatedAt)
                    const sortedNotes = notes.sort((a, b) => {
                        if (a.pinned && !b.pinned) return -1;
                        if (!a.pinned && b.pinned) return 1;
                        return b.updatedAt.getTime() - a.updatedAt.getTime();
                    });
                    SearchService.initialize(sortedNotes);
                    set({ notes: sortedNotes, filteredNotes: sortedNotes, isLoading: false });
                } catch (error) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            // Create a new note
            createNote: async (title: string, content: string) => {
                set({ isLoading: true, error: null });
                try {
                    const newNote: Note = {
                        id: title.endsWith('.md') ? title : `${title}.md`, // Store expects id to be the filename
                        title,
                        content,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        syncStatus: 'synced',
                        tags: [],
                        filePath: '' // Temporary, will be overwritten by StorageService
                    };

                    const savedNote = await StorageService.saveNote(newNote);
                    const notes = [savedNote, ...get().notes];
                    SearchService.initialize(notes);
                    set({ notes, filteredNotes: notes, isLoading: false });

                    return savedNote;
                } catch (error) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            // Update existing note
            updateNote: async (id: string, filePath: string, content: string) => {
                // Optimistic UI update could go here, but for now we wait for write
                try {
                    let currentNote = get().notes.find(n => n.id === id);

                    // Recover gracefully if note was dropped from state due to loadNotes race condition
                    if (!currentNote) {
                        currentNote = {
                            id,
                            title: id.replace('.md', ''),
                            content,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            filePath,
                            syncStatus: 'synced',
                            tags: [],
                            pinned: false,
                            domain: undefined
                        } as Note;
                    }

                    const updatedNoteBase = { ...currentNote, content };
                    const savedNote = await StorageService.saveNote(updatedNoteBase);

                    let notes = get().notes;
                    if (notes.some(n => n.id === id)) {
                        notes = notes.map((note) => note.id === id ? savedNote : note);
                    } else {
                        notes = [savedNote, ...notes];
                    }
                    SearchService.initialize(notes);

                    // Re-apply current search/filter
                    const { searchQuery, selectedTag } = get();
                    let filtered = notes;
                    if (searchQuery) {
                        const results = SearchService.search(searchQuery);
                        filtered = results.map(r => r.note);
                    } else if (selectedTag) {
                        filtered = SearchService.filterByTag(notes, selectedTag);
                    }

                    set({ notes, filteredNotes: filtered });
                    return savedNote;
                } catch (error) {
                    set({ error: (error as Error).message });
                    throw error;
                }
            },

            // Delete a note
            deleteNote: async (filePath: string) => {
                set({ isLoading: true, error: null });
                try {
                    // Find note to delete to pass full object if needed
                    const noteToDelete = get().notes.find(n => n.filePath === filePath);
                    if (noteToDelete) {
                        await StorageService.deleteNote(noteToDelete);
                    }

                    const notes = get().notes.filter((note) => note.filePath !== filePath);
                    SearchService.initialize(notes);
                    set({ notes, filteredNotes: notes, isLoading: false });
                } catch (error) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            // Archive a note
            archiveNote: async (filePath: string) => {
                set({ isLoading: true, error: null });
                try {
                    // Find note to archive to pass full object
                    const noteToArchive = get().notes.find(n => n.filePath === filePath);
                    if (noteToArchive) {
                        await StorageService.archiveNote(noteToArchive);
                    }

                    const notes = get().notes.filter((note) => note.filePath !== filePath);
                    SearchService.initialize(notes);
                    set({ notes, filteredNotes: notes, isLoading: false });
                } catch (error) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            // Toggle pin status of a note
            togglePinNote: async (noteId: string, currentContent?: string) => {
                try {
                    const note = get().notes.find(n => n.id === noteId);
                    if (!note) throw new Error('Note not found');

                    const newPinned = !note.pinned;
                    // Use provided content (from active editor) or fall back to store content
                    let contentToUpdate = currentContent !== undefined ? currentContent : note.content;
                    let newContent: string;

                    if (newPinned) {
                        newContent = updateFrontmatter(contentToUpdate, 'pinned', true);
                    } else {
                        newContent = removeFrontmatterKey(contentToUpdate, 'pinned');
                    }

                    const updatedNote = { ...note, content: newContent, pinned: newPinned };
                    await StorageService.saveNote(updatedNote);

                    // Update notes and re-sort
                    const notes = get().notes.map(n => n.id === noteId ? updatedNote : n);
                    const sortedNotes = notes.sort((a, b) => {
                        if (a.pinned && !b.pinned) return -1;
                        if (!a.pinned && b.pinned) return 1;
                        return b.updatedAt.getTime() - a.updatedAt.getTime();
                    });
                    SearchService.initialize(sortedNotes);
                    set({ notes: sortedNotes, filteredNotes: sortedNotes });
                } catch (error) {
                    set({ error: (error as Error).message });
                }
            },

            // Search notes
            searchNotes: (query: string) => {
                const currentTag = get().selectedTag;
                const currentDomain = get().currentDomain;

                let results = get().notes;

                // 1. Search text
                if (query.trim()) {
                    // Start with search results
                    const searchResults = SearchService.search(query);
                    // Map to Note objects
                    results = searchResults.map(r => r.note);
                }

                // 2. Filter by tag
                if (currentTag) {
                    results = results.filter(n => n.tags && n.tags.includes(currentTag));
                }

                // 3. Filter by domain
                if (currentDomain) {
                    results = results.filter(n => n.domain === currentDomain);
                }

                set({ filteredNotes: results, searchQuery: query });
            },

            // Filter by tag
            filterByTag: (tag: string | null) => {
                const query = get().searchQuery;
                const currentDomain = get().currentDomain;

                let results = get().notes;

                // 1. Search text
                if (query.trim()) {
                    const searchResults = SearchService.search(query);
                    results = searchResults.map(r => r.note);
                }

                // 2. Filter by tag
                if (tag) {
                    results = results.filter(n => n.tags && n.tags.includes(tag));
                }

                // 3. Filter by domain
                if (currentDomain) {
                    results = results.filter(n => n.domain === currentDomain);
                }

                set({ filteredNotes: results, selectedTag: tag });
            },

            // Filter by domain
            filterByDomain: (domain: DomainType | null) => {
                const query = get().searchQuery;
                const currentTag = get().selectedTag;

                let results = get().notes;

                // 1. Search text
                if (query.trim()) {
                    const searchResults = SearchService.search(query);
                    results = searchResults.map(r => r.note);
                }

                // 2. Filter by tag
                if (currentTag) {
                    results = results.filter(n => n.tags && n.tags.includes(currentTag));
                }

                // 3. Filter by domain
                if (domain) {
                    results = results.filter(n => n.domain === domain);
                }

                set({ filteredNotes: results, currentDomain: domain });
            },

            // Deprecated: Sync logic is now handled in saveNote via StorageService
            syncToObsidian: async (note: Note) => {
                // No-op or transparent save
                await StorageService.saveNote(note);
            },

            // Import note (Legacy/Manual import still useful)
            importFromObsidian: async (uri: string) => {
                // Implementation can stay similar if we want to copy *into* current storage
                // For now, let's just log or keep existing if it works with StorageService
                // But since we are moving to direct access, "import" might mean "copy file to current vault"
                // Skipping deep refactor of this specific method for now, focusing on core flow.
            },

            // Update app settings
            updateSettings: (newSettings: Partial<AppSettings>) => {
                const settings = { ...get().settings, ...newSettings };
                set({ settings });

                if (newSettings.vault !== undefined) {
                    StorageService.setConfig(newSettings.vault);
                    // Reload notes when vault config changes
                    get().loadNotes();
                }
            },

            // Set vault configuration
            setVaultConfig: (config: ObsidianVaultConfig) => {
                const settings = { ...get().settings, vault: config };
                set({ settings });
                StorageService.setConfig(config);
                get().loadNotes();
            },
        }),
        {
            name: 'notes-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ settings: state.settings, notes: state.notes }), // Persist settings and notes for caching
            onRehydrateStorage: () => (state) => {
                if (state?.settings?.vault) {
                    StorageService.setConfig(state.settings.vault);
                }
                if (state?.notes) {
                    // Hydrate Date objects
                    state.notes.forEach(n => {
                        n.createdAt = new Date(n.createdAt);
                        n.updatedAt = new Date(n.updatedAt);
                    });

                    // Immediately make notes available without showing full loading
                    state.filteredNotes = [...state.notes];
                    SearchService.initialize(state.notes);
                }
            }
        }
    )
);
