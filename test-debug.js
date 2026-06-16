const BASE_URL = 'http://localhost:3000';

async function test() {
  // Test API key creation
  const signup = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
    }),
  });

  const signupData = await signup.json();
  console.log('Signup response:', signupData);

  const merchantId = signupData.merchant?.id || signupData.apiKey;
  console.log('Merchant ID:', merchantId);

  // Try to create API key
  const apiKeyReq = await fetch(`${BASE_URL}/api/merchants/me/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': merchantId,
    },
    body: JSON.stringify({ name: 'Test Key' }),
  });

  console.log('API key creation status:', apiKeyReq.status);
  const apiKeyData = await apiKeyReq.text();
  console.log('API key response:', apiKeyData);
}

test().catch(console.error);
