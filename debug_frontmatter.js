
// Mock FrontmatterService logic to avoid import/transpilation issues

function parseFrontmatter(content) {
    // Updated robust regex
    const frontmatterRegex = /^\s*---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = content.substring(match[0].length);
    const frontmatter = {};

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

function buildContent(frontmatter, body) {
    const keys = Object.keys(frontmatter);

    if (keys.length === 0) {
        return body;
    }

    const lines = keys.map(key => {
        const value = frontmatter[key];
        return `${key}: ${value}`;
    });

    return `---\n${lines.join('\n')}\n---\n${body}`;
}

function updateFrontmatter(content, key, value) {
    const { frontmatter, body } = parseFrontmatter(content);
    frontmatter[key] = value;
    return buildContent(frontmatter, body);
}

// Test cases
const testCases = [
    // Case 1: Simple LF
    `---
domain: action
pinned: true
---
Body content`,

    // Case 2: CRLF
    `---\r\ndomain: action\r\npinned: true\r\n---\r\nBody content`,

    // Case 3: No trailing newline after fence
    `---\ndomain: action\n---`,

    // Case 4: Boolean existing
    `---\npinned: false\n---\nBody`,

    // Case 5: Empty frontmatter existing
    `---\n\n---\nBody`,

    // Case 6: Mixed newlines logic check
    `---\r\ndomain: test\n---\nBody`
];

console.log('--- Testing Parse ---');
testCases.forEach((content, i) => {
    console.log(`\nCase ${i + 1}:`);
    const result = parseFrontmatter(content);
    console.log('Frontmatter:', JSON.stringify(result.frontmatter));
    console.log('Body start:', JSON.stringify(result.body.substring(0, 10)));
});

console.log('\n--- Testing Update (Pinning) ---');
console.log('Original content: ---\\ndomain: test\\n---\\nBody');
const content = `---\ndomain: test\n---\nBody`;
const updated = updateFrontmatter(content, 'pinned', true);
console.log('Updated content:\n', JSON.stringify(updated));

const reparsed = parseFrontmatter(updated);
console.log('Reparsed pinned:', reparsed.frontmatter.pinned);
