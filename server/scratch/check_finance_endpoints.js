const axios = require('axios');

const API_BASE = 'http://localhost:4002/api';
const TOKEN = '...'; // I need a token, but I'll try to check if they are public or just see if they 404

const endpoints = [
    '/finance/voucher-types',
    '/finance/fiscal-years',
    '/finance/accounts',
    '/finance/tax-codes',
    '/sales/customers?active=true',
    '/purchase/suppliers?active=true',
    '/finance/currencies'
];

async function check() {
    for (const e of endpoints) {
        try {
            console.log(`Checking ${e}...`);
            // Without token it might 401, but 404 is what we are looking for
            const res = await axios.get(`${API_BASE}${e}`);
            console.log(`  Status: ${res.status}`);
        } catch (err) {
            console.log(`  Error: ${err.response?.status || err.message}`);
            if (err.response?.status === 404) {
                console.log(`  !!! 404 NOT FOUND: ${e}`);
            }
        }
    }
}

check();
