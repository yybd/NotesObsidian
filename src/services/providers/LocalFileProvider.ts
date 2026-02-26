import * as FileSystem from 'expo-file-system/legacy';
import { StorageProvider, FileStat } from './StorageProvider';

const LOCAL_NOTES_DIR = `${FileSystem.documentDirectory}notes/`;

export class LocalFileProvider implements StorageProvider {
    isSupported(): boolean {
        return true; // Always supported as fallback
    }

    private async ensureDirectory(dir: string) {
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
    }

    private getPath(fileName: string, subDirectory: string = ''): string {
        const dir = subDirectory ? `${LOCAL_NOTES_DIR}${subDirectory}/` : LOCAL_NOTES_DIR;
        return `${dir}${fileName}`;
    }

    async list(subDirectory: string = ''): Promise<FileStat[]> {
        const dirPath = subDirectory ? `${LOCAL_NOTES_DIR}${subDirectory}/` : LOCAL_NOTES_DIR;
        await this.ensureDirectory(dirPath);

        let files: string[] = [];
        try {
            files = await FileSystem.readDirectoryAsync(dirPath);
        } catch (e) {
            console.warn(`Could not read directory ${dirPath}`, e);
            return [];
        }

        const stats: FileStat[] = [];
        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const filePath = `${dirPath}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            const modTimeStr = fileInfo.exists ? (fileInfo.modificationTime || Date.now()) : Date.now();

            stats.push({
                name: file,
                modificationTime: new Date(modTimeStr).getTime()
            });
        }

        return stats;
    }

    async read(fileName: string, subDirectory: string = ''): Promise<string> {
        const filePath = this.getPath(fileName, subDirectory);
        return await FileSystem.readAsStringAsync(filePath);
    }

    async write(fileName: string, content: string, subDirectory: string = ''): Promise<void> {
        const dir = subDirectory ? `${LOCAL_NOTES_DIR}${subDirectory}/` : LOCAL_NOTES_DIR;
        await this.ensureDirectory(dir);
        await FileSystem.writeAsStringAsync(`${dir}${fileName}`, content);
    }

    async delete(fileName: string, subDirectory: string = ''): Promise<void> {
        const filePath = this.getPath(fileName, subDirectory);
        await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
}
