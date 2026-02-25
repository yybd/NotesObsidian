// FileService.ts - File system operations for managing markdown notes

import * as FileSystem from 'expo-file-system/legacy';
import { Note } from '../types/Note';

const NOTES_DIR = `${FileSystem.documentDirectory!}notes/`;

class FileService {
    /**
     * Initialize the notes directory
     */
    async initialize(): Promise<void> {
        try {
            const dirInfo = await FileSystem.getInfoAsync(NOTES_DIR);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(NOTES_DIR, { intermediates: true });
                console.log('Notes directory created');
            }
        } catch (error) {
            console.error('Error initializing notes directory:', error);
            throw error;
        }
    }

    /**
     * Get the notes directory path
     */
    getNotesDirectory(): string {
        return NOTES_DIR;
    }

    /**
     * Create a new note file
     */
    async createNote(title: string, content: string): Promise<Note> {
        try {
            const id = Date.now().toString();
            const fileName = this.sanitizeFileName(title) || `note-${id}`;
            const filePath = `${NOTES_DIR}${fileName}.md`;

            // Check if file already exists, add number if needed
            let finalPath = filePath;
            let counter = 1;
            while (await this.fileExists(finalPath)) {
                finalPath = `${NOTES_DIR}${fileName}-${counter}.md`;
                counter++;
            }

            await FileSystem.writeAsStringAsync(finalPath, content);

            const note: Note = {
                id,
                title,
                content,
                createdAt: new Date(),
                updatedAt: new Date(),
                filePath: finalPath,
                syncStatus: 'pending',
                tags: this.extractTags(content),
            };

            return note;
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }

    /**
     * Read a note from file
     */
    async readNote(filePath: string): Promise<Note | null> {
        try {
            const content = await FileSystem.readAsStringAsync(filePath);
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            const fileName = filePath.split('/').pop() || '';
            const title = fileName.replace('.md', '');

            const timestamp = (fileInfo.exists && 'modificationTime' in fileInfo)
                ? fileInfo.modificationTime || Date.now()
                : Date.now();

            return {
                id: timestamp.toString(),
                title,
                content,
                createdAt: new Date(timestamp),
                updatedAt: new Date(timestamp),
                filePath,
                syncStatus: 'synced',
                tags: this.extractTags(content),
            };
        } catch (error) {
            console.error('Error reading note:', error);
            return null;
        }
    }

    /**
     * Update an existing note
     */
    async updateNote(id: string, filePath: string, content: string): Promise<Note> {
        try {
            await FileSystem.writeAsStringAsync(filePath, content);

            const fileName = filePath.split('/').pop() || '';
            const title = fileName.replace('.md', '');

            return {
                id,
                title,
                content,
                createdAt: new Date(), // Could improve by reading from metadata
                updatedAt: new Date(),
                filePath,
                syncStatus: 'pending',
                tags: this.extractTags(content),
            };
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }

    /**
     * Delete a note file
     */
    async deleteNote(filePath: string): Promise<void> {
        try {
            await FileSystem.deleteAsync(filePath);
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }

    /**
     * Get all notes from the directory
     */
    async getAllNotes(): Promise<Note[]> {
        try {
            await this.initialize();

            const files = await FileSystem.readDirectoryAsync(NOTES_DIR);
            const mdFiles = files.filter((file) => file.endsWith('.md'));

            const notes: Note[] = [];
            for (const file of mdFiles) {
                const filePath = `${NOTES_DIR}${file}`;
                const note = await this.readNote(filePath);
                if (note) {
                    notes.push(note);
                }
            }

            // Sort by updated date, newest first
            return notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        } catch (error) {
            console.error('Error getting all notes:', error);
            return [];
        }
    }

    /**
     * Import a markdown file from external source
     */
    async importNote(sourceUri: string, title?: string): Promise<Note> {
        try {
            const content = await FileSystem.readAsStringAsync(sourceUri);
            const fileName = title || sourceUri.split('/').pop()?.replace('.md', '') || 'imported-note';

            return await this.createNote(fileName, content);
        } catch (error) {
            console.error('Error importing note:', error);
            throw error;
        }
    }

    // Helper methods

    private async fileExists(path: string): Promise<boolean> {
        try {
            const info = await FileSystem.getInfoAsync(path);
            return info.exists;
        } catch {
            return false;
        }
    }

    private sanitizeFileName(name: string): string {
        // Remove invalid characters for file names
        return name
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/\s+/g, '-')
            .substring(0, 100); // Limit length
    }

    private extractTags(content: string): string[] {
        const tagRegex = /#([a-zA-Z0-9_\u0590-\u05FF]+)/g;
        const matches = content.match(tagRegex);
        if (!matches) return [];

        return [...new Set(matches.map(tag => tag.substring(1)))];
    }
}

export default new FileService();
