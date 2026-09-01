import { isWithinVotingHours } from './server';

async function runTests() {
  console.log('=== Test Suite: Time-Based Voting Restriction (9:00 AM - 5:00 PM) ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} -> ${detail || ''}`);
    }
  }

  // 1. Unit Tests for isWithinVotingHours
  console.log('--- 1. Testing isWithinVotingHours Logic ---');

  // Test 8:59 AM (Before 9:00 AM)
  const d859 = new Date();
  d859.setHours(8, 59, 0, 0);
  const r859 = isWithinVotingHours('09:00', '17:00', d859);
  assert(r859.allowed === false, '8:59 AM should be outside voting window');
  assert(
    r859.message === 'Voting is closed. Allowed timing is strictly between 9:00 AM and 5:00 PM.',
    '8:59 AM rejection message matches exact required string',
    r859.message
  );

  // Test 9:00 AM (Start boundary)
  const d900 = new Date();
  d900.setHours(9, 0, 0, 0);
  const r900 = isWithinVotingHours('09:00', '17:00', d900);
  assert(r900.allowed === true, '9:00 AM should be inside voting window');

  // Test 12:30 PM (Midday)
  const d1230 = new Date();
  d1230.setHours(12, 30, 0, 0);
  const r1230 = isWithinVotingHours('09:00', '17:00', d1230);
  assert(r1230.allowed === true, '12:30 PM should be inside voting window');

  // Test 4:59 PM (16:59 - Before 5:00 PM)
  const d1659 = new Date();
  d1659.setHours(16, 59, 0, 0);
  const r1659 = isWithinVotingHours('09:00', '17:00', d1659);
  assert(r1659.allowed === true, '4:59 PM should be inside voting window');

  // Test 5:00 PM (17:00 - End boundary)
  const d1700 = new Date();
  d1700.setHours(17, 0, 0, 0);
  const r1700 = isWithinVotingHours('09:00', '17:00', d1700);
  assert(r1700.allowed === false, '5:00 PM should be outside voting window');
  assert(
    r1700.message === 'Voting is closed. Allowed timing is strictly between 9:00 AM and 5:00 PM.',
    '5:00 PM rejection message matches exact required string',
    r1700.message
  );

  // Test 9:15 PM (21:15 - Night)
  const d2115 = new Date();
  d2115.setHours(21, 15, 0, 0);
  const r2115 = isWithinVotingHours('09:00', '17:00', d2115);
  assert(r2115.allowed === false, '9:15 PM should be outside voting window');

  // 2. Integration Tests against Server API
  console.log('\n--- 2. Testing Server REST Endpoints (http://localhost:3000) ---');

  try {
    // Test GET /api/settings
    const resSettings = await fetch('http://localhost:3000/api/settings');
    const settings = await resSettings.json();
    assert(resSettings.status === 200, 'GET /api/settings returns 200 OK');
    assert('isWithinHours' in settings, 'GET /api/settings returns isWithinHours boolean');
    assert('startTime' in settings, 'GET /api/settings returns startTime');
    assert('endTime' in settings, 'GET /api/settings returns endTime');

    // Admin login
    const resLogin = await fetch('http://localhost:3000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    });
    const adminAuth = await resLogin.json();
    assert(resLogin.status === 200 && !!adminAuth.token, 'Admin login succeeded');

    // Update settings to a window outside current time (e.g. 01:00 to 02:00 AM)
    const resHours = await fetch('http://localhost:3000/api/settings/hours', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.token}`
      },
      body: JSON.stringify({ startTime: '01:00', endTime: '02:00', enforceTimeWindow: true })
    });
    assert(resHours.status === 200, 'POST /api/settings/hours updated successfully');

    // Create a test voter token
    const resVerify = await fetch('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9999988888', code: '123456' })
    });
    const voterAuth = await resVerify.json();
    assert(resVerify.status === 200 && !!voterAuth.token, 'Voter login succeeded');

    // Attempt to vote while window is 01:00-02:00 (outside current time)
    const resVoteBlocked = await fetch('http://localhost:3000/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voterAuth.token}`
      },
      body: JSON.stringify({ partyId: 'p1' })
    });
    const blockData = await resVoteBlocked.json();
    assert(resVoteBlocked.status === 403, 'POST /api/vote returns 403 Forbidden outside window');
    assert(
      blockData.error.includes('Voting is closed. Allowed timing is strictly between'),
      '403 response contains clear allowed timing message',
      blockData.error
    );

    // Reset settings back to standard 09:00 - 17:00
    await fetch('http://localhost:3000/api/settings/hours', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.token}`
      },
      body: JSON.stringify({ startTime: '09:00', endTime: '17:00', enforceTimeWindow: true })
    });
    console.log('Restored standard voting hours (09:00 – 17:00).');

  } catch (err: any) {
    console.error('Server endpoint testing error:', err.message);
  }

  console.log(`\n=== Results: ${passed} of ${total} tests passed ===`);
  if (passed === total) {
    console.log('🎉 ALL TIME RESTRICTION TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

runTests();
