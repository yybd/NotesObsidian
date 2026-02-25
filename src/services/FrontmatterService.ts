// FrontmatterService.ts - Parse and update YAML frontmatter in markdown files

interface Frontmatter {
    [key: string]: any;
}

interface ParseResult {
    frontmatter: Frontmatter;
    body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): ParseResult {
    const frontmatterRegex = /^\s*---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = content.substring(match[0].length);
    const frontmatter: Frontmatter = {};

    // Parse simple YAML (key: value pairs)
    frontmatterStr.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();

            // Parse boolean values
            if (value === 'true') {
                frontmatter[key] = true;
            } else if (value === 'false') {
                frontmatter[key] = false;
            } else if (!isNaN(Number(value)) && value !== '') {
                frontmatter[key] = Number(value);
            } else {
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                frontmatter[key] = value;
            }
        }
    });

    return { frontmatter, body };
}

/**
 * Update or add a frontmatter property
 */
export function updateFrontmatter(content: string, key: string, value: any): string {
    const { frontmatter, body } = parseFrontmatter(content);
    frontmatter[key] = value;
    return buildContent(frontmatter, body);
}

/**
 * Remove a frontmatter property
 */
export function removeFrontmatterKey(content: string, key: string): string {
    const { frontmatter, body } = parseFrontmatter(content);
    delete frontmatter[key];
    return buildContent(frontmatter, body);
}

/**
 * Get content without frontmatter (for display)
 */
export function getContentWithoutFrontmatter(content: string): string {
    const { body } = parseFrontmatter(content);
    return body;
}

/**
 * Check if content has a specific frontmatter property
 */
export function hasFrontmatterProperty(content: string, key: string): boolean {
    const { frontmatter } = parseFrontmatter(content);
    return key in frontmatter;
}

/**
 * Get a specific frontmatter property value
 */
export function getFrontmatterProperty<T>(content: string, key: string): T | undefined {
    const { frontmatter } = parseFrontmatter(content);
    return frontmatter[key] as T | undefined;
}

/**
 * Build content with frontmatter
 */
/**
 * Build content with frontmatter
 */
export function composeContent(frontmatter: Frontmatter, body: string): string {
    return buildContent(frontmatter, body);
}

function buildContent(frontmatter: Frontmatter, body: string): string {
    const keys = Object.keys(frontmatter);

    if (keys.length === 0) {
        return body;
    }

    const lines = keys.map(key => {
        const value = frontmatter[key];
        if (typeof value === 'boolean') {
            return `${key}: ${value}`;
        } else if (typeof value === 'number') {
            return `${key}: ${value}`;
        } else {
            return `${key}: ${value}`;
        }
    });

    return `---\n${lines.join('\n')}\n---\n${body}`;
}

export default {
    parseFrontmatter,
    updateFrontmatter,
    removeFrontmatterKey,
    getContentWithoutFrontmatter,
    hasFrontmatterProperty,
    getFrontmatterProperty,
    composeContent,
};
