import { handleListContinuation } from './src/utils/markdownUtils';

const oldText = "- [ ] Task 1\n- [ ] Task 2";
const newText = "- [ ] Task 1\n\n- [ ] Task 2"; // pressing enter after 'Task 1'

console.log('Test middle:', handleListContinuation(newText, oldText));

const oldText2 = "- Item 1\nSome other text";
const newText2 = "- Item 1\n\nSome other text";
console.log('Test middle 2:', handleListContinuation(newText2, oldText2));

const oldText3 = "- Item 1";
const newText3 = "- Item 1\n\n"; // typed an extra enter
console.log('Test double enter:', handleListContinuation(newText3, oldText3));
