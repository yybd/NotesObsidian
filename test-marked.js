const { marked } = require('marked');
const { NodeHtmlMarkdown } = require('node-html-markdown');

const md = "- [ ] Unchecked\n- [x] Checked\n\n- Regular list";
const html = marked.parse(md, { gfm: true, breaks: true });
console.log("--- MARKED HTML ---");
console.log(html);

const nhm = new NodeHtmlMarkdown({}, undefined, undefined);
const backMd = nhm.translate(html);
console.log("--- NHM BACK MD ---");
console.log(backMd);

const pellHtml = `<ol class="x-todo"><li><span contenteditable="false" class="x-todo-box"><input type="checkbox"></span>Unchecked from Pell</li></ol><ol class="x-todo"><li><span contenteditable="false" class="x-todo-box"><input type="checkbox" checked="true"></span>Checked from Pell</li></ol>`;
const pellBackMd = nhm.translate(pellHtml);
console.log("--- PELL HTML TO MD ---");
console.log(pellBackMd);
