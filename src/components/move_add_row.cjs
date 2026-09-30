const fs = require('fs');
const file = 'TeamLeadDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Use regex to find the block
const addRowRegex = /\{\s*isAdding && \(\s*<tr className="draft-row fresh">[\s\S]*?<\/tr>\s*\)\s*\}/;
const match = content.match(addRowRegex);

if (!match) {
  console.log('Could not find isAdding start');
  process.exit(1);
}

const blockToMove = match[0];
content = content.replace(blockToMove, '');

const tbodyStartRegex = /<tbody>\s*\{\s*bidder\.rows\.map\(r => \{/;
const startMatch = content.match(tbodyStartRegex);
if (!startMatch) {
  console.log('Could not find tbody start');
  process.exit(1);
}

content = content.replace(startMatch[0], `<tbody>\n              ${blockToMove}\n              {bidder.rows.map(r => {`);

fs.writeFileSync(file, content);
console.log('Done!');
