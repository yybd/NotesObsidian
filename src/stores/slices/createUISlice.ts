import { StateCreator } from 'zustand';
import { DomainType } from '../../types/Note';
import SearchService from '../../services/SearchService';
import { StoreState } from '../notesStore';

export interface UISlice {
    searchQuery: string;
    selectedTag: string | null;
    currentDomain: DomainType | null;
    isLoading: boolean;
    error: string | null;
    searchNotes: (query: string) => void;
    filterByTag: (tag: string | null) => void;
    filterByDomain: (domain: DomainType | null) => void;
}

export const createUISlice: StateCreator<
    StoreState,
    [],
    [],
    UISlice
> = (set, get) => ({
    searchQuery: '',
    selectedTag: null,
    currentDomain: null,
    isLoading: false,
    error: null,

    searchNotes: (query: string) => {
        const currentTag = get().selectedTag;
        const currentDomain = get().currentDomain;

        let results = get().notes;

        if (query.trim()) {
            const searchResults = SearchService.search(query);
            results = searchResults.map((r) => r.note);
        }

        if (currentTag) {
            results = results.filter((n) => n.tags && n.tags.includes(currentTag));
        }

        if (currentDomain) {
            results = results.filter((n) => n.domain === currentDomain);
        }

        set({ filteredNotes: results, searchQuery: query });
    },

    filterByTag: (tag: string | null) => {
        const query = get().searchQuery;
        const currentDomain = get().currentDomain;

        let results = get().notes;

        if (query.trim()) {
            const searchResults = SearchService.search(query);
            results = searchResults.map((r) => r.note);
        }

        if (tag) {
            results = results.filter((n) => n.tags && n.tags.includes(tag));
        }

        if (currentDomain) {
            results = results.filter((n) => n.domain === currentDomain);
        }

        set({ filteredNotes: results, selectedTag: tag });
    },

    filterByDomain: (domain: DomainType | null) => {
        const query = get().searchQuery;
        const currentTag = get().selectedTag;

        let results = get().notes;

        if (query.trim()) {
            const searchResults = SearchService.search(query);
            results = searchResults.map((r) => r.note);
        }

        if (currentTag) {
            results = results.filter((n) => n.tags && n.tags.includes(currentTag));
        }

        if (domain) {
            results = results.filter((n) => n.domain === domain);
        }

        set({ filteredNotes: results, currentDomain: domain });
    },
});
