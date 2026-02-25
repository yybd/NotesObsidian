// editorUtils.ts - Shared Markdown formatting, logic and constants

// Convert markdown to HTML for TenTap editor
export const markdownToHtml = (md: string): string => {
    if (!md) return '';
    return md
        // Task lists (checkboxes) - must come before regular lists
        .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div>$1</div></li></ul>')
        .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div>$1</div></li></ul>')
        // Standard formatting
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<s>$1</s>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, '<br>');
};

// Convert HTML back to markdown for saving
export const htmlToMarkdown = (html: string): string => {
    if (!html) return '';
    return html
        // Task list items (checkboxes) - must come before stripping tags
        .replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="true"[^>]*>.*?<div>(.+?)<\/div><\/li>/gs, '- [x] $1\n')
        .replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="false"[^>]*>.*?<div>(.+?)<\/div><\/li>/gs, '- [ ] $1\n')
        // Also handle simpler checkbox formats
        .replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>.*?<\/li>/gs, '- [x] ')
        .replace(/<input[^>]*type="checkbox"[^>]*>.*?<\/li>/gs, '- [ ] ')
        // Standard formatting
        .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
        .replace(/<b>(.+?)<\/b>/g, '**$1**')
        .replace(/<em>(.+?)<\/em>/g, '*$1*')
        .replace(/<i>(.+?)<\/i>/g, '*$1*')
        .replace(/<s>(.+?)<\/s>/g, '~~$1~~')
        .replace(/<strike>(.+?)<\/strike>/g, '~~$1~~')
        .replace(/<u>(.+?)<\/u>/g, '$1')  // Underline not standard MD
        .replace(/<code>(.+?)<\/code>/g, '`$1`')
        .replace(/<h1>(.+?)<\/h1>/g, '# $1\n')
        .replace(/<h2>(.+?)<\/h2>/g, '## $1\n')
        .replace(/<h3>(.+?)<\/h3>/g, '### $1\n')
        .replace(/<h4>(.+?)<\/h4>/g, '#### $1\n')
        .replace(/<blockquote>(.+?)<\/blockquote>/gs, '> $1\n')
        .replace(/<li>(.+?)<\/li>/g, '- $1\n')
        .replace(/<a href="([^"]+)">(.+?)<\/a>/g, '[$2]($1)')
        .replace(/<hr\s*\/?>/g, '---\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.+?)<\/p>/gs, '$1\n\n')
        .replace(/<ul[^>]*>|<\/ul>/g, '')  // Remove ul tags
        .replace(/<ol[^>]*>|<\/ol>/g, '')  // Remove ol tags
        .replace(/<\/?[^>]+(>|$)/g, '')    // Strip remaining tags
        .replace(/\n{3,}/g, '\n\n');       // Clean up excess newlines
};

// Extract title (first line) and body (rest) from text content
export const extractTitleAndBody = (content: string) => {
    const lines = content.split('\n');
    const firstLine = lines[0] || '';
    const restLines = lines.slice(1).join('\n');

    // Remove # from title for display
    const title = firstLine.replace(/^#+\s*/, '').trim();
    const hasTitle = firstLine.startsWith('#');

    // Body content (without first line if it's a title)
    const bodyContent = hasTitle ? restLines : content;
    return { title, hasTitle, bodyContent };
};

// Re-export RTL utilities from centralized source for backwards compatibility
export { getDirection, RTL_TEXT_STYLE, rtlTextStyle, RTL_ROW } from './rtlUtils';
