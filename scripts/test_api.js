const http = require('http');

const req = http.get('http://localhost:4002/api/sales/orders?page=1', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`BODY: ${data.substring(0, 100)}...`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});
