async function run() {
  try {
    console.log('Logging in...');
    const loginRes = await fetch('https://demoserver.omnisuite-erp.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    });
    console.log('Login Status:', loginRes.status);
    const loginData = await loginRes.json();
    if (!loginData.accessToken) {
      console.log('No token in response:', loginData);
      return;
    }
    const token = loginData.accessToken;
    console.log('Token successfully obtained! Length:', token.length);

    const endpoints = [
      '/api/admin/companies',
      '/api/admin/page-permissions?path=%2F',
      '/api/auth/user-branches',
      '/api/inventory/alerts/low-stock'
    ];

    for (const ep of endpoints) {
      console.log(`\nFetching ${ep}...`);
      try {
        const res = await fetch(`https://demoserver.omnisuite-erp.com${ep}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log(`Status for ${ep}:`, res.status);
        const text = await res.text();
        console.log(`Body (truncated):`, text.slice(0, 300));
      } catch (err) {
        console.error(`Error fetching ${ep}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

run();
