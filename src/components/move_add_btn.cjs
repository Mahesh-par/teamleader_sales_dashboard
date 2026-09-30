const fs = require('fs');
const file = 'TeamLeadDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const addBtnRegex = /\{\!isAdding && <button className="btn mini add-row" onClick=\{\(\) => startAddRow\(bidder\.id\)\}>\+ Add a client<\/button>\}/;
content = content.replace(addBtnRegex, '');

const wrapScrollRegex = /<div className="wrapscroll">/;
const newWrapScroll = `<div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
        {!isAdding && <button className="btn mini add-row" onClick={() => startAddRow(bidder.id)}>+ Add a client</button>}
      </div>\n      <div className="wrapscroll">`;

content = content.replace(wrapScrollRegex, newWrapScroll);

fs.writeFileSync(file, content);
console.log('Done!');
