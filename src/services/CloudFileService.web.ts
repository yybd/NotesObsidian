// CloudFileService.web.ts — Web platform stub.
// Metro picks this file automatically when bundling for web (over the .ts
// sibling) so the iOS-only `local-file-bookmark` native module is never
// imported on the web bundle. All methods are inert because security-scoped
// bookmarks have no equivalent in the browser; the web build instead relies
// on WebFileService for storage access (File System Access API).

class CloudFileService {
    private readonly isAvailable = false;

    async selectFolder(): Promise<string | null> {
        return null;
    }

    getBookmarkedPath(): string | null {
        return null;
    }

    async isConfigured(): Promise<boolean> {
        return false;
    }

    async writeFile(_filename: string, _content: string): Promise<void> {
        throw new Error('CloudFileService is not available on web');
    }

    async readFile(_filename: string): Promise<string> {
        throw new Error('CloudFileService is not available on web');
    }

    async listMarkdownFilesWithAttributes(): Promise<{ name: string; path: string; modificationTime?: number }[]> {
        return [];
    }

    async listSubdirFilesWithAttributes(_subpath: string): Promise<{ name: string; path: string; modificationTime?: number }[]> {
        return [];
    }

    async listMarkdownFiles(): Promise<string[]> {
        return [];
    }

    async fileExists(_filename: string): Promise<boolean> {
        return false;
    }

    async deleteFile(_filename: string): Promise<void> {
        throw new Error('CloudFileService is not available on web');
    }
}

export default new CloudFileService();
