const axios = require('axios');
require('dotenv').config();

async function testLogsAPI() {
  try {
    // First login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Got token:', token.substring(0, 20) + '...\n');
    
    // Test logs API
    console.log('📡 Fetching logs from API...');
    const logsResponse = await axios.get('http://localhost:3000/api/logs?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ API Response:');
    console.log(`  Success: ${logsResponse.data.success}`);
    console.log(`  Count: ${logsResponse.data.count}`);
    console.log(`  Data length: ${logsResponse.data.data?.length || 0}\n`);
    
    if (logsResponse.data.data && logsResponse.data.data.length > 0) {
      console.log('📝 Sample logs from API:');
      logsResponse.data.data.slice(0, 3).forEach((log, i) => {
        console.log(`\n[${i + 1}]:`);
        console.log(`  Category: ${log.category}`);
        console.log(`  Message: ${log.message?.substring(0, 60)}...`);
        console.log(`  Timestamp: ${log.timestamp}`);
      });
    } else {
      console.log('❌ NO LOGS RETURNED FROM API!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testLogsAPI();
