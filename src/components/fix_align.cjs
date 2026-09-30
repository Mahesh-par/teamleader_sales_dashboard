const fs = require('fs');
const file = 'TeamLeadDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<button className="btn mini add-row" onClick={() => startAddRow(bidder.id)}>+ Add a client</button>',
  '<button className="btn mini add-row" style={{ marginTop: 0 }} onClick={() => startAddRow(bidder.id)}>+ Add a client</button>'
);

fs.writeFileSync(file, content);
console.log('Done!');
