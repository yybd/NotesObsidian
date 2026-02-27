// MarkdownConverterService.ts
// Bidirectional converter between raw Markdown (stored on disk) and HTML
// (consumed by the TiptapEditor WebView).
//
// Tiptap's task list format:
//   <ul data-type="taskList">
//     <li data-type="taskItem" data-checked="false"><label>...</label><div><p>text</p></div></li>
//     <li data-type="taskItem" data-checked="true"><label>...</label><div><p>done</p></div></li>
//   </ul>
//
// Markdown GFM task list format (what is stored on disk):
//   - [ ] unchecked item
//   - [x] checked item

import { marked } from 'marked';
import { NodeHtmlMarkdown } from 'node-html-markdown';

const nhm = new NodeHtmlMarkdown({}, undefined, undefined);

class MarkdownConverterService {
    // ─── Markdown → HTML ──────────────────────────────────────────────────────

    /**
     * Converts raw Markdown to Tiptap-compatible HTML.
     * GFM task lists are converted to Tiptap's <ul data-type="taskList"> structure.
     */
    static markdownToHtml(markdown: string): string {
        if (!markdown) return '';
        try {
            // 0. Pre-process markdown to normalize task items.
            // We use a unique marker that is highly unlikely to appear in natural text.
            // We preserve the list bullet structure so marked still sees it as a list item.
            let preprocessed = markdown.replace(/^(\s*[-*+]\s*)\[ \]\s*/gm, '$1TASK_UNCHECKED_MARKER ');
            preprocessed = preprocessed.replace(/^(\s*[-*+]\s*)\[[xX]\]\s*/gm, '$1TASK_CHECKED_MARKER ');

            let html = marked.parse(preprocessed, { gfm: true, breaks: true }) as string;

            // 1. Convert our markers OR marked's own GFM output into Tiptap taskItem format.

            // Handle our markers
            html = html.replace(
                /<li>\s*(?:<p>\s*)?TASK_(UNCHECKED|CHECKED)_MARKER\s*([\s\S]*?)\s*(?:<\/p>)?\s*<\/li>/gi,
                (_match, type, content) => {
                    const isChecked = type === 'CHECKED';
                    return (
                        `<li data-type="taskItem" data-checked="${isChecked}">` +
                        `<label></label><div><p>${content.trim()}</p></div>` +
                        `</li>`
                    );
                },
            );

            // Handle marked's GFM output (<input type="checkbox">)
            html = html.replace(
                /<li[^>]*>\s*(?:<p>\s*)?<input[^>]*type="checkbox"[^>]*\/?>\s*([\s\S]*?)\s*(?:<\/p>)?\s*<\/li>/gi,
                (_match, content) => {
                    const isChecked = /<input\b[^>]*?\bchecked\b/i.test(_match);
                    return (
                        `<li data-type="taskItem" data-checked="${isChecked}">` +
                        `<label></label><div><p>${content.trim()}</p></div>` +
                        `</li>`
                    );
                },
            );

            // 2. Extra Robustness: Catch literal "[ ]" that might have survived inside ANY <li>
            html = html.replace(
                /<li>\s*(?:<p>\s*)?\[([ xX])\]\s*([\s\S]*?)\s*(?:<\/p>)?\s*<\/li>/gi,
                (_match, type, content) => {
                    const isChecked = type.toLowerCase() === 'x';
                    return (
                        `<li data-type="taskItem" data-checked="${isChecked}">` +
                        `<label></label><div><p>${content.trim()}</p></div>` +
                        `</li>`
                    );
                },
            );

            // 3. Wrap ALL specifically converted <li data-type="taskItem"> items in a taskList <ul>
            // Also handle <ol> if marked outputted that for some reason.
            html = html.replace(
                /<(ul|ol)>([\s\S]*?data-type="taskItem"[\s\S]*?)<\/\1>/gi,
                '<ul data-type="taskList">$2</ul>',
            );

            return html;
        } catch (error) {
            console.error('MarkdownConverterService.markdownToHtml error:', error);
            return '<p>Error loading content.</p>';
        }
    }

    // ─── HTML → Markdown ──────────────────────────────────────────────────────

    /**
     * Converts Tiptap HTML back to raw GFM Markdown for storage.
     * Handles both Tiptap task list format and falls back gracefully for other HTML.
     */
    static htmlToMarkdown(html: string): string {
        if (!html) return '';
        try {
            // 1. Convert Tiptap task items to plain "- [ ] " / "- [x] " text BEFORE
            //    NodeHtmlMarkdown sees the list, so NHM treats them as normal list items
            //    whose text already contains the checkbox token.
            //    Use lookaheads so data-type and data-checked match in any order.
            let processed = html.replace(
                /<li(?=[^>]*data-type="taskItem")(?=[^>]*data-checked="(true|false)")[^>]*>([\s\S]*?)<\/li>/gi,
                (_match, checked, inner) => {
                    const prefix = checked === 'true' ? '- [x] ' : '- [ ] ';
                    // Strip the <label> element (Tiptap's checkbox widget) and any
                    // surrounding <div><p> wrapper so only the plain text survives.
                    const text = inner
                        .replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
                        .replace(/<\/?div[^>]*>/gi, '')
                        .replace(/<\/?p[^>]*>/gi, '')
                        .replace(/<[^>]+>/g, '')
                        .trim();
                    return `<li>${prefix}${text}</li>`;
                },
            );

            // 2. Remove the data-type attribute so NHM renders the list as a normal <ul>
            processed = processed.replace(/ data-type="taskList"/gi, '');

            let md = nhm.translate(processed);

            // 3. NHM escapes special chars in our "- [ ] " prefix.
            //    Depending on NHM version / bullet style, output may be:
            //      "* \- \[ \] text"  or  "* \[ \] text"  or  "- \- \[ \] text"
            md = md.replace(/^\* \\?-? ?\\\[ ?\\\] /gm, '- [ ] ');
            md = md.replace(/^\* \\?-? ?\\\[x\\\] /gim, '- [x] ');
            md = md.replace(/^- \\?-? ?\\\[ ?\\\] /gm, '- [ ] ');
            md = md.replace(/^- \\?-? ?\\\[x\\\] /gim, '- [x] ');

            return md;
        } catch (error) {
            console.error('MarkdownConverterService.htmlToMarkdown error:', error);
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, '');
        }
    }
}

export default MarkdownConverterService;
