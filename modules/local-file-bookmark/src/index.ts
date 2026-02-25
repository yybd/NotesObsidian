import { NativeModules } from 'react-native';

export interface BookmarkedDirectory {
    path: string;
    url: string;
}

const { LocalFileBookmark } = NativeModules;

// Methods
/**
 * Pick a directory and save a security-scoped bookmark for persistent access
 */
export async function pickAndBookmarkDirectory(): Promise<BookmarkedDirectory | null> {
    try {
        const result = await LocalFileBookmark.pickAndBookmarkDirectory();
        return result;
    } catch (error: any) {
        if (error.code === 'CANCELLED') {
            return null;
        }
        throw error;
    }
}

/**
 * Get the currently bookmarked directory
 */
export async function getBookmarkedDirectory(): Promise<BookmarkedDirectory | null> {
    const result = await LocalFileBookmark.getBookmarkedDirectory();
    return result;
}

/**
 * Write a file to the bookmarked directory
 */
export async function writeFile(filename: string, content: string): Promise<string> {
    return await LocalFileBookmark.writeFile(filename, content);
}

/**
 * Read a file from the bookmarked directory
 */
export async function readFile(filename: string): Promise<string> {
    return await LocalFileBookmark.readFile(filename);
}

/**
 * List all files in the bookmarked directory
 */
export async function listFiles(): Promise<string[]> {
    return await LocalFileBookmark.listFiles();
}

/**
 * Delete a file from the bookmarked directory
 */
export async function deleteFile(filename: string): Promise<boolean> {
    return await LocalFileBookmark.deleteFile(filename);
}

/**
 * List all files in the bookmarked directory with attributes
 */
export async function listFilesWithAttributes(): Promise<any[]> {
    return await LocalFileBookmark.listFilesWithAttributes();
}

/**
 * List all files in a specific subdirectory of the bookmarked directory with attributes
 */
export async function listSubdirFilesWithAttributes(subpath: string): Promise<any[]> {
    return await LocalFileBookmark.listSubdirFilesWithAttributes(subpath);
}

export default {
    pickAndBookmarkDirectory,
    getBookmarkedDirectory,
    writeFile,
    readFile,
    listFiles,
    listFilesWithAttributes,
    listSubdirFilesWithAttributes,
    deleteFile,
};
