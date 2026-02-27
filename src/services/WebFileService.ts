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
                // Query permission (but don't request, as it needs user gesture)
                const status = await handle.queryPermission({ mode: 'readwrite' });
                return status === 'granted';
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
    async verifyPermission(readWrite: boolean = true): Promise<boolean> {
        if (!this.directoryHandle) return false;

        const options: FileSystemHandlePermissionDescriptor = {
            mode: readWrite ? 'readwrite' : 'read',
        };

        if ((await this.directoryHandle.queryPermission(options)) === 'granted') {
            return true;
        }

        try {
            if ((await this.directoryHandle.requestPermission(options)) === 'granted') {
                return true;
            }
        } catch (e) {
            console.warn('Permission request failed (likely needs user gesture):', e);
        }

        return false;
    }

    /**
     * Get a handle for a subdirectory, creating it if needed
     */
    private async getSubDirHandle(subDirName: string, create: boolean = false): Promise<FileSystemDirectoryHandle | null> {
        if (!this.directoryHandle) return null;
        if (!subDirName) return this.directoryHandle;

        try {
            return await this.directoryHandle.getDirectoryHandle(subDirName, { create });
        } catch (error) {
            if (!create) return null;
            throw error;
        }
    }

    /**
     * List all markdown files in a directory
     */
    async listMarkdownFiles(subDir?: string): Promise<{ name: string; modificationTime: number }[]> {
        if (!this.directoryHandle) return [];

        const files: { name: string; modificationTime: number }[] = [];
        try {
            const dirHandle = subDir ? await this.getSubDirHandle(subDir) : this.directoryHandle;
            if (!dirHandle) return [];

            for await (const entry of (dirHandle as any).values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                    const file = await entry.getFile();
                    files.push({
                        name: entry.name,
                        modificationTime: file.lastModified
                    });
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
    async readFile(filename: string, subDir?: string): Promise<string> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            const dirHandle = subDir ? await this.getSubDirHandle(subDir) : this.directoryHandle;
            if (!dirHandle) throw new Error(`Directory ${subDir} not found`);

            const fileHandle = await dirHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (error) {
            console.error(`Error reading ${filename} in ${subDir || 'root'}:`, error);
            throw error;
        }
    }

    /**
     * Write file content
     */
    async writeFile(filename: string, content: string, subDir?: string): Promise<void> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            const dirHandle = subDir ? await this.getSubDirHandle(subDir, true) : this.directoryHandle;
            if (!dirHandle) throw new Error(`Could not access directory ${subDir}`);

            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (error) {
            console.error(`Error writing ${filename} in ${subDir || 'root'}:`, error);
            throw error;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(filename: string, subDir?: string): Promise<void> {
        if (!this.directoryHandle) throw new Error('No directory selected');

        try {
            const dirHandle = subDir ? await this.getSubDirHandle(subDir) : this.directoryHandle;
            if (!dirHandle) return; // Already gone or non-existent dir

            await dirHandle.removeEntry(filename);
        } catch (error) {
            console.error(`Error deleting ${filename} in ${subDir || 'root'}:`, error);
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
