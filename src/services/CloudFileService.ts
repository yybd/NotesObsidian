// CloudFileService.ts - Security-Scoped Bookmarks for iOS
// Direct access to ANY folder in iCloud Drive (including existing Obsidian vaults!)

import { Platform } from 'react-native';
import * as FileBookmark from 'local-file-bookmark';

class CloudFileService {
    private isAvailable: boolean = false;
    private bookmarkedPath: string | null = null;

    constructor() {
        this.isAvailable = Platform.OS === 'ios';
        if (this.isAvailable) {
            this.loadBookmark();
        }
    }

    /**
     * Load saved bookmark
     */
    private async loadBookmark(): Promise<void> {
        try {
            const bookmark = await FileBookmark.getBookmarkedDirectory();
            if (bookmark) {
                this.bookmarkedPath = bookmark.path;
                console.log('📚 Loaded bookmarked directory:', this.bookmarkedPath);
            }
        } catch (error) {
            console.error('Error loading bookmark:', error);
        }
    }

    /**
     * Pick a folder and save its bookmark
     * This allows the user to select their existing Obsidian vault!
     */
    async selectFolder(): Promise<string | null> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log('📂 Opening folder picker...');

            const bookmark = await FileBookmark.pickAndBookmarkDirectory();

            if (bookmark) {
                this.bookmarkedPath = bookmark.path;
                console.log('✅ Folder selected and bookmarked:', bookmark.path);
                return bookmark.path;
            }

            return null;
        } catch (error) {
            console.error('Error selecting folder:', error);
            throw error;
        }
    }

    /**
     * Get the currently bookmarked path
     */
    getBookmarkedPath(): string | null {
        return this.bookmarkedPath;
    }

    /**
     * Check if a folder is bookmarked
     */
    async isConfigured(): Promise<boolean> {
        if (!this.isAvailable) return false;

        const bookmark = await FileBookmark.getBookmarkedDirectory();
        return bookmark !== null;
    }

    /**
     * Write a file directly to the bookmarked folder
     */
    async writeFile(filename: string, content: string): Promise<void> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log('☁️ Writing file:', filename);

            const filePath = await FileBookmark.writeFile(filename, content);

            console.log('✅ File written:', filePath);
        } catch (error) {
            console.error('Error writing file:', error);
            throw error;
        }
    }

    /**
     * Read a file from the bookmarked folder
     */
    async readFile(filename: string): Promise<string> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            const content = await FileBookmark.readFile(filename);

            return content;
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    }

    /**
     * List all files in the bookmarked folder with attributes
     */
    async listMarkdownFilesWithAttributes(): Promise<{ name: string, path: string, modificationTime?: number }[]> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log('📂 Listing files with attributes...');

            const files = await FileBookmark.listFilesWithAttributes();

            // Filter for .md files
            const mdFiles = files.filter((f: any) => f.name.endsWith('.md'));

            console.log(`Found ${mdFiles.length} markdown files with attributes`);
            return mdFiles;
        } catch (error) {
            console.error('Error listing files with attributes:', error);
            return [];
        }
    }

    /**
     * List all files in a specific subdirectory of the bookmarked folder with attributes
     */
    async listSubdirFilesWithAttributes(subpath: string): Promise<{ name: string, path: string, modificationTime?: number }[]> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log(`📂 Listing files in subdir: ${subpath}...`);

            const files = await FileBookmark.listSubdirFilesWithAttributes(subpath);

            // Filter for .md files
            const mdFiles = files.filter((f: any) => f.name.endsWith('.md'));

            console.log(`Found ${mdFiles.length} markdown files in ${subpath}`);
            return mdFiles;
        } catch (error) {
            console.error(`Error listing files in ${subpath}:`, error);
            return [];
        }
    }

    /**
     * List all files in the bookmarked folder
     */
    async listMarkdownFiles(): Promise<string[]> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log('📂 Listing files...');

            const files = await FileBookmark.listFiles();

            // Filter for .md files
            const mdFiles = files.filter((filename: string) => filename.endsWith('.md'));

            console.log(`Found ${mdFiles.length} markdown files`);
            return mdFiles;
        } catch (error) {
            console.error('Error listing files:', error);
            return [];
        }
    }

    /**
     * Check if a file exists
     */
    async fileExists(filename: string): Promise<boolean> {
        if (!this.isAvailable) return false;

        try {
            const files = await FileBookmark.listFiles();
            return files.includes(filename);
        } catch (error) {
            console.error('Error checking file existence:', error);
            return false;
        }
    }

    /**
     * Delete a file
     */
    async deleteFile(filename: string): Promise<void> {
        if (!this.isAvailable) {
            throw new Error('Bookmarks not available on this platform');
        }

        try {
            console.log('🗑️ Deleting file:', filename);

            await FileBookmark.deleteFile(filename);

            console.log('✅ File deleted');
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }
}

export default new CloudFileService();
