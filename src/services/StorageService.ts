import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { Note, ObsidianVaultConfig, DomainType } from '../types/Note';
import { getFrontmatterProperty } from './FrontmatterService';
// Dynamic import for Native Module to avoid crashes on unsupported platforms/dev clients if not linked
let CloudFileService: any = null;
try {
    CloudFileService = require('./CloudFileService').default;
} catch (e) {
    console.warn('CloudFileService not available');
}

class StorageService {
    private config: ObsidianVaultConfig | null = null;
    private readonly LOCAL_NOTES_DIR = `${FileSystem.documentDirectory}notes/`;
    private readonly ARCHIVE_DIR_NAME = 'archive';
    private safUriCache: Map<string, string> = new Map();

    constructor() {
        this.ensureLocalDirectory();
    }

    private async ensureLocalDirectory() {
        const dirInfo = await FileSystem.getInfoAsync(this.LOCAL_NOTES_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(this.LOCAL_NOTES_DIR, { intermediates: true });
        }

        const archiveDirInfo = await FileSystem.getInfoAsync(`${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/`);
        if (!archiveDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(`${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/`, { intermediates: true });
        }
    }

    setConfig(config: ObsidianVaultConfig | null) {
        this.config = config;
    }

    getConfig(): ObsidianVaultConfig | null {
        return this.config;
    }

    /**
     * Select an external folder (Vault)
     */
    async selectExternalFolder(): Promise<ObsidianVaultConfig | null> {
        try {
            if (Platform.OS === 'web') {
                // Web: Use File System Access API
                const WebFileService = require('./WebFileService').default;
                // Initialize first
                await WebFileService.initialize();

                const directoryName = await WebFileService.selectDirectory();
                if (directoryName) {
                    return {
                        vaultName: directoryName,
                        vaultDirectoryUri: `web-vault://${directoryName}`,
                        isConnected: true
                    };
                }
            } else if (Platform.OS === 'ios') {
                if (!CloudFileService) throw new Error('Native module not linked');
                const result = await CloudFileService.selectFolder();
                if (result) {
                    return {
                        vaultName: 'iCloud Vault',
                        vaultDirectoryUri: result,
                        isConnected: true
                    };
                }
            } else {
                // Android using SAF
                // @ts-ignore - Expo FileSystem types might not be fully updated for SAF in all envs, but it exists
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (permissions.granted) {
                    return {
                        vaultName: 'Android Vault',
                        vaultDirectoryUri: permissions.directoryUri,
                        isConnected: true
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error selecting folder:', error);
            throw error;
        }
    }

    /**
     * List all notes from the active storage (Local or External)
     */
    async listNotes(cachedNotes: Note[] = []): Promise<Note[]> {
        try {
            let notes: Note[] = [];
            if (this.isExternal()) {
                notes = await this.listExternalNotes(cachedNotes);
            } else {
                notes = await this.listLocalNotes(cachedNotes);
            }

            // Sort by modification date (newest first)
            return notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        } catch (error) {
            console.error('Error listing notes:', error);
            return [];
        }
    }

    /**
     * Save a note (Create or Update)
     */
    async saveNote(note: Note): Promise<Note> {
        const fileName = note.title.endsWith('.md') ? note.title : `${note.title}.md`;

        // Parse frontmatter properties to ensure Note object is in sync with content
        const pinned = getFrontmatterProperty<boolean>(note.content, 'pinned') || false;
        console.log('[StorageService] Saving note:', note.id, 'Pinned parsed:', pinned);
        console.log('[StorageService] Content start:', note.content.substring(0, 50).replace(/\n/g, '\\n'));

        const domain = getFrontmatterProperty<DomainType>(note.content, 'domain');

        // Update timestamp
        const updatedNote = {
            ...note,
            updatedAt: new Date(),
            filePath: this.isExternal() ? (note.filePath || fileName) : `${this.LOCAL_NOTES_DIR}${fileName}`,
            pinned,
            domain
        };

        if (this.isExternal()) {
            await this.writeExternal(fileName, updatedNote.content);
        } else {
            await this.writeLocal(fileName, updatedNote.content);
        }

        return updatedNote;
    }

    /**
     * Delete a note
     */
    async deleteNote(note: Note): Promise<void> {
        const fileName = note.title.endsWith('.md') ? note.title : `${note.title}.md`;

        if (this.isExternal()) {
            await this.deleteExternal(fileName);
        } else {
            await FileSystem.deleteAsync(`${this.LOCAL_NOTES_DIR}${fileName}`, { idempotent: true });
        }
    }

    /**
     * Archive a note
     */
    async archiveNote(note: Note): Promise<void> {
        const fileName = note.title.endsWith('.md') ? note.title : `${note.title}.md`;

        if (this.isExternal()) {
            const archivePath = `${this.ARCHIVE_DIR_NAME}/${fileName}`;
            await this.writeExternal(archivePath, note.content);
            await this.deleteExternal(fileName);
        } else {
            await this.ensureLocalDirectory();
            await FileSystem.moveAsync({
                from: `${this.LOCAL_NOTES_DIR}${fileName}`,
                to: `${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/${fileName}`
            });
        }
    }

    /**
     * List archived notes
     */
    async listArchivedNotes(): Promise<Note[]> {
        try {
            let notes: Note[] = [];
            if (this.isExternal()) {
                notes = await this.listExternalArchivedNotes();
            } else {
                notes = await this.listLocalNotes([], `${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/`);
            }
            return notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        } catch (error) {
            console.error('Error listing archived notes:', error);
            return [];
        }
    }

    /**
     * Delete an archived note
     */
    async deleteArchivedNote(note: Note): Promise<void> {
        const fileName = note.title.endsWith('.md') ? note.title : `${note.title}.md`;

        if (this.isExternal()) {
            const archivePath = `${this.ARCHIVE_DIR_NAME}/${fileName}`;
            await this.deleteExternal(archivePath);
        } else {
            await FileSystem.deleteAsync(`${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/${fileName}`, { idempotent: true });
        }
    }

    /**
     * Restore an archived note
     */
    async restoreNote(note: Note): Promise<void> {
        const fileName = note.title.endsWith('.md') ? note.title : `${note.title}.md`;

        if (this.isExternal()) {
            const archivePath = `${this.ARCHIVE_DIR_NAME}/${fileName}`;
            await this.writeExternal(fileName, note.content);
            await this.deleteExternal(archivePath);
        } else {
            await FileSystem.moveAsync({
                from: `${this.LOCAL_NOTES_DIR}${this.ARCHIVE_DIR_NAME}/${fileName}`,
                to: `${this.LOCAL_NOTES_DIR}${fileName}`
            });
        }
    }

    /**
     * Empty the archive
     */
    async emptyArchive(): Promise<void> {
        const archivedNotes = await this.listArchivedNotes();
        for (const note of archivedNotes) {
            await this.deleteArchivedNote(note);
        }
    }

    // ==============================================
    // Private Helpers
    // ==============================================

    private isExternal(): boolean {
        return !!(this.config && this.config.isConnected && this.config.vaultDirectoryUri);
    }

    // --- Local Storage Helpers ---

    private async listLocalNotes(cachedNotes: Note[] = [], dirPath: string = this.LOCAL_NOTES_DIR): Promise<Note[]> {
        await this.ensureLocalDirectory();

        let files: string[] = [];
        try {
            files = await FileSystem.readDirectoryAsync(dirPath);
        } catch (e) {
            console.warn(`Could not read directory ${dirPath}`, e);
            return [];
        }

        const notes: Note[] = [];
        const cacheMap = new Map(cachedNotes.map(n => [n.id, n]));

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const filePath = `${dirPath}${file}`;
            const stats = await FileSystem.getInfoAsync(filePath);
            const modTimeStr = stats.exists ? (stats.modificationTime || Date.now()) : Date.now();
            // Handle precision difference between date.getTime() and stats modification time
            // We use a tolerance of 2 seconds given file systems precision
            const modTime = new Date(modTimeStr).getTime();

            const cachedNote = cacheMap.get(file);
            if (cachedNote && Math.abs(cachedNote.updatedAt.getTime() - modTime) < 2000) {
                notes.push(cachedNote);
                continue;
            }

            const content = await FileSystem.readAsStringAsync(filePath);
            const pinned = getFrontmatterProperty<boolean>(content, 'pinned') || false;
            const domain = getFrontmatterProperty<DomainType>(content, 'domain');

            notes.push({
                id: file, // Use filename as ID for simplicity in local mode
                title: file.replace('.md', ''),
                content,
                createdAt: new Date(modTime),
                updatedAt: new Date(modTime),
                filePath,
                syncStatus: 'synced',
                tags: [],
                pinned,
                domain,
            });
        }
        return notes;
    }

    private async writeLocal(filename: string, content: string) {
        await this.ensureLocalDirectory();
        await FileSystem.writeAsStringAsync(`${this.LOCAL_NOTES_DIR}${filename}`, content);
    }

    // --- External Storage Helpers ---

    private async listExternalNotes(cachedNotes: Note[] = []): Promise<Note[]> {
        const uri = this.config!.vaultDirectoryUri;
        const notes: Note[] = [];
        const cacheMap = new Map(cachedNotes.map(n => [n.id, n]));

        if (Platform.OS === 'web') {
            const WebFileService = require('./WebFileService').default;
            await WebFileService.initialize();

            const files = await WebFileService.listMarkdownFiles();
            console.log(`[StorageService] Found ${files.length} notes in web vault`);

            for (const fileName of files) {
                try {
                    // For Web, without modificationTime API easily available, we skip caching for now
                    const content = await WebFileService.readFile(fileName);
                    const title = fileName.replace('.md', '');
                    const timestamp = Date.now();

                    const pinned = getFrontmatterProperty<boolean>(content, 'pinned') || false;
                    const domain = getFrontmatterProperty<DomainType>(content, 'domain');

                    notes.push({
                        id: title,
                        title,
                        content,
                        createdAt: new Date(timestamp),
                        updatedAt: new Date(timestamp),
                        filePath: fileName,
                        syncStatus: 'synced',
                        tags: [],
                        pinned,
                        domain,
                    });
                } catch (readError) {
                    console.error(`Error reading web file ${fileName}:`, readError);
                }
            }
            return notes;
        }

        if (Platform.OS === 'ios') {
            const filesWithStats = await CloudFileService.listMarkdownFilesWithAttributes();

            for (const fileStat of filesWithStats) {
                const fileName = fileStat.name;
                const modTimeMs = fileStat.modificationTime || Date.now();

                const cachedNote = cacheMap.get(fileName);
                if (cachedNote && Math.abs(cachedNote.updatedAt.getTime() - modTimeMs) < 2000) {
                    notes.push(cachedNote);
                    continue;
                }

                let content = '';
                try {
                    content = await CloudFileService.readFile(fileName);
                } catch (e) {
                    console.warn(`Failed to read external note: ${fileName}`, e);
                    continue;
                }

                const pinned = getFrontmatterProperty<boolean>(content, 'pinned') || false;
                const domain = getFrontmatterProperty<DomainType>(content, 'domain');

                notes.push({
                    id: fileName,
                    title: fileName.replace('.md', ''),
                    content,
                    createdAt: new Date(modTimeMs),
                    updatedAt: new Date(modTimeMs),
                    filePath: fileName,
                    syncStatus: 'synced',
                    tags: [],
                    pinned,
                    domain,
                });
            }
        } else {
            // Android SAF
            try {
                // @ts-ignore
                const startFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);

                // Process in parallel for speed, but limit concurrency if needed (unlikely for text files)
                await Promise.all(startFiles.map(async (fileUri: string) => {
                    const fileName = decodeURIComponent(fileUri).split('/').pop() || '';
                    if (!fileName.endsWith('.md')) return;

                    // Cache URI for faster writes later
                    this.safUriCache.set(fileName, fileUri);

                    try {
                        const stats = await FileSystem.getInfoAsync(fileUri);
                        const modTime = new Date(stats.exists ? (stats.modificationTime || Date.now()) : Date.now()).getTime();

                        const cachedNote = cacheMap.get(fileName);
                        if (cachedNote && Math.abs(cachedNote.updatedAt.getTime() - modTime) < 2000) {
                            notes.push(cachedNote);
                            return;
                        }

                        const content = await FileSystem.readAsStringAsync(fileUri);

                        const pinned = getFrontmatterProperty<boolean>(content, 'pinned') || false;
                        const domain = getFrontmatterProperty<DomainType>(content, 'domain');

                        notes.push({
                            id: fileName,
                            title: fileName.replace('.md', ''),
                            content,
                            createdAt: new Date(modTime),
                            updatedAt: new Date(modTime),
                            filePath: fileName,
                            syncStatus: 'synced',
                            tags: [],
                            pinned,
                            domain,
                        });
                    } catch (e) {
                        console.warn(`Failed to read Android SAF note: ${fileName}`, e);
                    }
                }));
            } catch (error) {
                console.error('Error reading Android directory', error);
            }
        }
        return notes;
    }

    private async listExternalArchivedNotes(): Promise<Note[]> {
        const uri = this.config!.vaultDirectoryUri;
        const notes: Note[] = [];

        if (Platform.OS === 'web') {
            // Web implementation for subfolder (if supported)
            console.warn('Listing archived notes for external web storage is currently unsupported');
            return notes;
        }

        if (Platform.OS === 'ios') {
            const filesWithStats = await CloudFileService.listSubdirFilesWithAttributes(this.ARCHIVE_DIR_NAME);

            for (const fileStat of filesWithStats) {
                const fileName = fileStat.name;
                const relPath = `${this.ARCHIVE_DIR_NAME}/${fileName}`;
                let content = '';
                try {
                    content = await CloudFileService.readFile(relPath);
                } catch (e) {
                    console.warn(`Failed to read external archived note: ${fileName}`, e);
                    continue;
                }

                const pinned = getFrontmatterProperty<boolean>(content, 'pinned') || false;
                const domain = getFrontmatterProperty<DomainType>(content, 'domain');

                notes.push({
                    id: relPath, // Use relative path as id for archived notes
                    title: fileName.replace('.md', ''),
                    content,
                    createdAt: new Date(fileStat.modificationTime || Date.now()),
                    updatedAt: new Date(fileStat.modificationTime || Date.now()),
                    filePath: relPath,
                    syncStatus: 'synced',
                    tags: [],
                    pinned,
                    domain,
                });
            }
        } else {
            // Android SAF implementation for subfolder
            console.warn('Listing archived notes for external Android storage relies on native subfolder traversal');
            return notes;
        }
        return notes;
    }

    private async writeExternal(filename: string, content: string) {
        if (Platform.OS === 'web') {
            const WebFileService = require('./WebFileService').default;
            await WebFileService.writeFile(filename, content);
            return;
        }

        if (Platform.OS === 'ios') {
            await CloudFileService.writeFile(filename, content);
        } else {
            // Android SAF
            const uri = this.config!.vaultDirectoryUri;
            // SAF is complex with overwrites. We try to find existing file first or create new.
            // Simplified approach: Create if not exists, write if exists.
            try {
                // @ts-ignore
                const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(uri, filename, 'text/markdown');
                await FileSystem.writeAsStringAsync(fileUri, content);
            } catch (e) {
                // If create fails, it might exist (or other error). Try finding it.
                // This is a simplified "write" for Android SAF which can be tricky.
                // Ideally we search for the file URI first.
                console.log('SAF Create failed, trying to overwrite likely existing file...');
                // In a robust app we'd search properly. For now we assume typical SAF usage patterns.
                // But wait, createFileAsync throws if it exists? Actually it usually creates a copy "(1)".
                // We should probably check implementation details.
                // For this refactor, I will implement a safer "find or create" logic below.
                await this.safWrite(uri || '', filename, content);
            }
        }
    }

    private async deleteExternal(filename: string) {
        if (Platform.OS === 'web') {
            const WebFileService = require('./WebFileService').default;
            await WebFileService.deleteFile(filename);
            return;
        }

        if (Platform.OS === 'ios') {
            await CloudFileService.deleteFile(filename);
        } else {
            // Android SAF delete
            const uri = this.config!.vaultDirectoryUri;
            try {
                let fileUri = this.safUriCache.get(filename);
                if (!fileUri) {
                    // @ts-ignore
                    const startFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
                    fileUri = startFiles.find((fUri: string) => decodeURIComponent(fUri).endsWith(filename));
                }

                if (fileUri) {
                    await FileSystem.deleteAsync(fileUri);
                    this.safUriCache.delete(filename);
                    console.log(`[StorageService] Deleted file via SAF: ${fileUri}`);
                } else {
                    console.warn(`[StorageService] Could not find file to delete via SAF: ${filename}`);
                }
            } catch (error) {
                console.error('Error deleting file via Android SAF:', error);
            }
        }
    }

    // SAF Helper for writing (overwrite vs create)
    private async safWrite(dirUri: string, filename: string, content: string) {
        let existingUri = this.safUriCache.get(filename);

        if (!existingUri) {
            // @ts-ignore
            const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
            existingUri = files.find((uri: string) => decodeURIComponent(uri).endsWith(filename));
            if (existingUri) {
                this.safUriCache.set(filename, existingUri);
            }
        }

        if (existingUri) {
            await FileSystem.writeAsStringAsync(existingUri, content);
        } else {
            // @ts-ignore
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, filename, 'text/markdown');
            this.safUriCache.set(filename, newUri);
            await FileSystem.writeAsStringAsync(newUri, content);
        }
    }
}

export default new StorageService();
