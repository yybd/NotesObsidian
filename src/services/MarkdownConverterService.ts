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
            // marked with gfm:true emits <input disabled type="checkbox"> inside <li>
            let html = marked.parse(markdown, { gfm: true, breaks: true }) as string;

            // Convert marked's <li><input disabled> into Tiptap taskItem format.
            // Match any <li> containing an <input type="checkbox"> regardless of
            // attribute order (marked may emit checked/disabled/type in any order).
            // The <input> may be wrapped in <p> depending on the marked version.
            html = html.replace(
                /<li>\s*(?:<p>\s*)?<input[^>]*type="checkbox"[^>]*\/?>\s*([\s\S]*?)\s*(?:<\/p>)?\s*<\/li>/gi,
                (_match, content) => {
                    // Check for "checked" as a standalone attribute on the <input> tag,
                    // not inside "checkbox" or in the content text (e.g. "unchecked").
                    const isChecked = /<input\b[^>]*?\bchecked\b/i.test(_match);
                    const cleanContent = content.trim();
                    return (
                        `<li data-type="taskItem" data-checked="${isChecked}">` +
                        `<label></label><div><p>${cleanContent}</p></div>` +
                        `</li>`
                    );
                },
            );

            // Wrap the converted <li data-type="taskItem"> items in a taskList <ul>
            html = html.replace(
                /<ul>((?:(?!<\/ul>)[\s\S])*?data-type="taskItem"(?:(?!<\/ul>)[\s\S])*?)<\/ul>/gi,
                '<ul data-type="taskList">$1</ul>',
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
