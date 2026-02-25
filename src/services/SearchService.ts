// SearchService.ts - Fuzzy search implementation using Fuse.js

import Fuse from 'fuse.js';
import { Note, SearchResult } from '../types/Note';

class SearchService {
    private fuse: Fuse<Note> | null = null;

    /**
     * Initialize the search index with notes
     */
    initialize(notes: Note[]): void {
        const options = {
            keys: [
                { name: 'title', weight: 0.7 },
                { name: 'content', weight: 0.3 },
                { name: 'tags', weight: 0.5 },
            ],
            threshold: 0.3, // Lower = more strict matching
            includeMatches: true,
            includeScore: true,
            minMatchCharLength: 2,
            ignoreLocation: true,
        };

        this.fuse = new Fuse(notes, options);
    }

    /**
     * Search for notes matching the query
     */
    search(query: string): SearchResult[] {
        if (!this.fuse || !query.trim()) {
            return [];
        }

        const results = this.fuse.search(query);

        return results.map((result) => ({
            note: result.item,
            matches: result.matches || [],
            score: result.score || 0,
        }));
    }

    /**
     * Filter notes by tag
     */
    filterByTag(notes: Note[], tag: string): Note[] {
        return notes.filter((note) => note.tags?.includes(tag));
    }

    /**
     * Get all unique tags from notes
     */
    getAllTags(notes: Note[]): string[] {
        const tagSet = new Set<string>();
        notes.forEach((note) => {
            note.tags?.forEach((tag) => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }

    /**
     * Extract text snippet around a match
     */
    getContextSnippet(content: string, matchIndex: number, contextLength: number = 50): string {
        const start = Math.max(0, matchIndex - contextLength);
        const end = Math.min(content.length, matchIndex + contextLength);

        let snippet = content.substring(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet;
    }

    /**
     * Highlight search terms in text
     */
    highlightMatches(text: string, matches: Array<{ indices: number[][] }>): string {
        if (!matches || matches.length === 0) return text;

        let highlighted = text;
        const allIndices: number[][] = [];

        // Collect all match indices
        matches.forEach((match) => {
            if (match.indices) {
                allIndices.push(...match.indices);
            }
        });

        // Sort indices by start position (descending) to avoid offset issues
        allIndices.sort((a, b) => b[0] - a[0]);

        // Wrap matches with highlight markers
        allIndices.forEach(([start, end]) => {
            highlighted =
                highlighted.substring(0, start) +
                '**' + highlighted.substring(start, end + 1) + '**' +
                highlighted.substring(end + 1);
        });

        return highlighted;
    }
}

export default new SearchService();
