// WebFileService.ts - File System Access API Wrapper
// Handles interaction with local folders on the Web

import { saveDirectoryHandle, getDirectoryHandle, clearDirectoryHandle } from '../utils/webStorage';

class WebFileService {
    private directoryHandle: FileSystemDirectoryHandle | null = null;

    /**
     * Check if File System Access API is supported
     */
    isSupported(): boolean {
        return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    }

    /**
     * Initialize by checking for saved handle
     */
    async initialize(): Promise<boolean> {
        if (!this.isSupported()) return false;

        try {
            const handle = await getDirectoryHandle();
            if (handle) {
                this.directoryHandle = handle;
                // Verify permission
                const permission = await this.verifyPermission(handle, false);
                return permission;
            }
        } catch (error) {
            console.error('Error initializing web file service:', error);
        }
        return false;
    }

    /**
     * Open directory picker
     */
    async selectDirectory(): Promise<string | null> {
        if (!this.isSupported()) {
            throw new Error('File System Access API not supported');
        }

        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });

            this.directoryHandle = handle;
            await saveDirectoryHandle(handle);

            return handle.name;
        } catch (error) {
            // User cancelled or error
            if ((error as Error).name !== 'AbortError') {
                console.error('Error selecting directory:', error);
            }
            return null;
        }
    }

    /**
     * Verify and request permission
     */
    async verifyPermission(handle: FileSystemDirectoryHandle, readWrite: boolean): Promise<boolean> {
        const options: FileSystemHandlePermissionDescriptor = {
            mode: readWrite ? 'readwrite' : 'read',
        };

        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }

        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }

        return false;
    }

    /**
     * List all markdown files recursively (or flat for now)
     */
    async listMarkdownFiles(): Promise<string[]> {
        if (!this.directoryHandle) return [];

        const files: string[] = [];
        try {
            // Verify permission first
            const hasPermission = await this.verifyPermission(this.directoryHandle, false);
            if (!hasPermission) return [];

            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                    files.push(entry.name);
                }
            }
        } catch (error) {
            console.error('Error listing files:', error);
        }
        return files;
    }

    /**
     * Read file content
     */
    async readFile(filename: string): Promise<string> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            const fileHandle = await this.directoryHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (error) {
            console.error(`Error reading ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Write file content
     */
    async writeFile(filename: string, content: string): Promise<void> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            // Verify write permission
            await this.verifyPermission(this.directoryHandle, true);

            const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (error) {
            console.error(`Error writing ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(filename: string): Promise<void> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            // Verify write permission
            await this.verifyPermission(this.directoryHandle, true);
            await this.directoryHandle.removeEntry(filename);
        } catch (error) {
            console.error(`Error deleting ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Get handle name
     */
    getDirectoryName(): string | null {
        return this.directoryHandle ? this.directoryHandle.name : null;
    }
}

export default new WebFileService();
