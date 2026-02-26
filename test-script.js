const { marked } = require('marked');
const { NodeHtmlMarkdown } = require('node-html-markdown');

const markdownToHtml = (md) => {
    let html = marked.parse(md, { gfm: true, breaks: true });
    
    // Convert marked's disabled checkboxes to pell's active x-todo structure
    // Marked formats checklists as: <input checked="" disabled="" type="checkbox">
    html = html.replace(/<input\s+(checked="")?\s*disabled=""\s*type="checkbox">/gi, (match, checked) => {
        const isChecked = !!checked;
        return `<span contenteditable="false" class="x-todo-box"><input type="checkbox"${isChecked ? ' checked="true"' : ''}></span>`;
    });

    // Marked sometimes wraps list items in <p>. Unwrap them for Pell checkboxes
    html = html.replace(/<li>\s*<p>(<span[^>]+x-todo-box[^>]+>.*?<\/span>)(.*?)<\/p>\s*<\/li>/gi, '<li>$1$2</li>');
    
    // Add x-todo class to parent ul/ol if they contain x-todo-box
    html = html.replace(/<ul>(?=[\s\S]*?x-todo-box)/gi, '<ul class="x-todo">');

    return html;
};

const htmlToMarkdown = (html) => {
    // 1. Pre-process HTML: Convert Pell's checkbox spans into raw text "[ ] " or "[x] "
    let preProcessedHtml = html.replace(/<span[^>]*class="x-todo-box"[^>]*>.*?<input[^>]*type="checkbox"[^>]*(checked(="[^"]*")?)?[^>]*>.*?<\/span>/gi, (match, checkedAttr) => {
        return !!checkedAttr ? '[x] ' : '[ ] ';
    });

    // Remove the x-todo class so NHM doesn't do anything weird
    preProcessedHtml = preProcessedHtml.replace(/ class="x-todo"/gi, '');

    const nhm = new NodeHtmlMarkdown({}, undefined, undefined);
    let md = nhm.translate(preProcessedHtml);

    // 2. Post-process MD: NHM escapes the brackets as \[ \] and \[x\]. Revert them back.
    // Also, it might prefix them with "* \[ \]". We want standard "- [ ]".
    md = md.replace(/\* \\\[ \\\] /g, '- [ ] ');
    md = md.replace(/\* \\\[x\\\] /gi, '- [x] ');
    
    // Handle Pell's <ol> checklists which might render as "1. \[ \]"
    md = md.replace(/\d+\. \\\[ \\\] /g, '- [ ] ');
    md = md.replace(/\d+\. \\\[x\\\] /gi, '- [x] ');

    return md;
};

const md = "- [ ] Unchecked\n- [x] Checked\n\n- Regular list";
const html = markdownToHtml(md);
console.log("--- MD TO HTML ---");
console.log(html);

const backMd = htmlToMarkdown(html);
console.log("--- HTML TO MD ---");
console.log(backMd);

const pellHtml = `<ol class="x-todo"><li><span contenteditable="false" class="x-todo-box"><input type="checkbox"></span>Unchecked from Pell</li></ol><ol class="x-todo"><li><span contenteditable="false" class="x-todo-box"><input type="checkbox" checked="true"></span>Checked from Pell</li></ol>`;
const pellBackMd = htmlToMarkdown(pellHtml);
console.log("--- PELL HTML TO MD ---");
console.log(pellBackMd);
