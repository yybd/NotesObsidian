
// Mock FrontmatterService logic (Copy-Pasted from file)
function parseFrontmatter(content) {
    // BOM-aware regex
    const frontmatterRegex = /^[\uFEFF\s]*---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = content.substring(match[0].length);
    const frontmatter = {};

    frontmatterStr.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();

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

// Simulation
console.log("--- Pinning Flow Simulation ---");

// Scenario 1: No Frontmatter
let content1 = "Just some text";
console.log("\n[Scenario 1] Original:", JSON.stringify(content1));
let pinned1 = updateFrontmatter(content1, 'pinned', true);
console.log("Pinned:", JSON.stringify(pinned1));
let unpinned1 = updateFrontmatter(pinned1, 'pinned', false);
console.log("Unpinned:", JSON.stringify(unpinned1));

// Scenario 2: Existing Frontmatter
let content2 = "---\ndomain: work\n---\nTask list";
console.log("\n[Scenario 2] Original:", JSON.stringify(content2));
let pinned2 = updateFrontmatter(content2, 'pinned', true);
console.log("Pinned:", JSON.stringify(pinned2));

// Scenario 3: Mixed Line Endings (CRLF) as found in Windows/some editors
let content3 = "---\r\ndomain: personal\r\n---\r\nMy Note";
console.log("\n[Scenario 3] Original (CRLF):", JSON.stringify(content3));
let pinned3 = updateFrontmatter(content3, 'pinned', true);
console.log("Pinned:", JSON.stringify(pinned3));

// Scenario 4: Existing Pinned False
let content4 = "---\npinned: false\n---\nNote";
console.log("\n[Scenario 4] Original:", JSON.stringify(content4));
let pinned4 = updateFrontmatter(content4, 'pinned', true);
console.log("Pinned:", JSON.stringify(pinned4));

// Scenario 5: BOM (Byte Order Mark)
let content5 = "\uFEFF---\ndomain: test\n---\nBody";
console.log("\n[Scenario 5] Original (BOM):", JSON.stringify(content5));
let pinned5 = updateFrontmatter(content5, 'pinned', true);
console.log("Pinned:", JSON.stringify(pinned5));

