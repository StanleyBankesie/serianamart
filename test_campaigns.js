const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:4002/api',
  withCredentials: true,
});

async function test() {
  try {
    console.log('\n=== STEP 1: Login ===');
    const loginRes = await api.post('/auth/login', {
      email: 'admin@omnisuite.com',
      password: 'admin123',
    });
    console.log('Login response:', { token: loginRes.data.token ? 'present' : 'missing', user: loginRes.data.user?.id });
    
    const token = loginRes.data.token;
    api.defaults.headers.Authorization = `Bearer ${token}`;
    
    console.log('\n=== STEP 2: Get Company ID ===');
    const meRes = await api.get('/admin/me');
    console.log('User data:', { 
      userId: meRes.data.id, 
      companyIds: meRes.data.companyIds,
      username: meRes.data.username
    });
    const companyId = meRes.data.companyIds?.[0];
    
    console.log('\n=== STEP 3: Create Discount Campaign ===');
    const createRes = await api.post('/sales/discount-schemes/discount', {
      scheme_code: 'TEST-' + Date.now(),
      scheme_name: 'Test Campaign ' + Date.now(),
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      min_quantity: 1,
      description: 'Test',
      is_active: 1,
      itemIds: [],
    });
    console.log('Created campaign:', createRes.data);
    
    console.log('\n=== STEP 4: Fetch All Campaigns ===');
    const fetchRes = await api.get('/sales/discount-schemes');
    console.log('Fetched campaigns:', { 
      count: fetchRes.data.items?.length || 0,
      items: fetchRes.data.items?.slice(0, 3),
    });

    console.log('\n=== STEP 5: Create Purchase Reward Campaign ===');
    const rewardRes = await api.post('/sales/purchase-reward-campaigns', {
      campaign_name: 'Test Reward ' + Date.now(),
      campaign_qty: 5,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      is_active: 1,
      rows: [],
    });
    console.log('Created reward campaign:', rewardRes.data);
    
    console.log('\n=== STEP 6: Fetch Purchase Reward Campaigns ===');
    const rewardFetchRes = await api.get('/sales/purchase-reward-campaigns');
    console.log('Fetched reward campaigns:', { 
      count: rewardFetchRes.data.items?.length || 0,
      items: rewardFetchRes.data.items?.slice(0, 3),
    });

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    process.exit(1);
  }
}

test();
