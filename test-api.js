// Test script to verify API endpoints
const baseUrl = process.argv[2] || 'http://localhost:5000';

async function testLogin() {
  console.log(`\nTesting login at ${baseUrl}/api/auth/login`);
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'omar_braham@wgresorts.com',
        password: 'test123'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Login endpoint working!');
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Error connecting to API:', error.message);
  }
}

async function testRegister() {
  console.log(`\nTesting register at ${baseUrl}/api/auth/register`);
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 201 || response.status === 200) {
      console.log('✅ Register endpoint working!');
    } else {
      console.log('⚠️ Register response:', data.error || data.message);
    }
  } catch (error) {
    console.log('❌ Error connecting to API:', error.message);
  }
}

async function testMe() {
  console.log(`\nTesting auth check at ${baseUrl}/api/auth/me`);
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ Me endpoint working (returns 401 when not authenticated)');
    } else {
      console.log('Response:', data);
    }
  } catch (error) {
    console.log('❌ Error connecting to API:', error.message);
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('API Endpoint Tests');
  console.log('='.repeat(50));
  
  await testLogin();
  await testRegister();
  await testMe();
  
  console.log('\n' + '='.repeat(50));
  console.log('Tests complete!');
  console.log('To test production, run: node test-api.js https://your-app.vercel.app');
}

runTests();