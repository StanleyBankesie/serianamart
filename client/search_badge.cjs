const fs = require('fs');
const path = 'c:/Users/stanl/OneDrive/Documents/Stanness Technologies/kaf/client/src/pages/modules/transport/transportation-bills/TransportationBillForm.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('Badge')) {
    console.log(`${i+1}: ${l}`);
  }
});
