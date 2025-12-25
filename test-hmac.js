#!/usr/bin/env node

/**
 * HMAC Signature Test Script
 *
 * Tests HMAC-signed requests to your Supabase Edge Functions
 *
 * Usage:
 *   HMAC_SECRET=your-secret FUNCTION_URL=https://xyz.functions.supabase.co/quick-battles-sync node test-hmac.js
 *
 * Or set defaults below and run:
 *   node test-hmac.js
 */

const crypto = require('crypto');

// Configuration
const HMAC_SECRET = process.env.HMAC_SECRET || '98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39';
const FUNCTION_URL = process.env.FUNCTION_URL || 'https://YOUR_PROJECT_REF.functions.supabase.co/quick-battles-sync';

// Test payloads
const tests = [
  {
    name: 'Valid signature (should succeed)',
    body: { test: 'ping', timestamp: Date.now() },
    tamper: false,
    oldTimestamp: false
  },
  {
    name: 'Invalid signature (should fail with 401)',
    body: { test: 'ping', timestamp: Date.now() },
    tamper: true,
    oldTimestamp: false
  },
  {
    name: 'Old timestamp >5min (should fail with 401)',
    body: { test: 'ping', timestamp: Date.now() },
    tamper: false,
    oldTimestamp: true
  }
];

/**
 * Generate HMAC signature
 */
function generateSignature(timestamp, body, secret) {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Run a single test
 */
async function runTest(test) {
  const bodyString = JSON.stringify(test.body);

  // Generate timestamp (5.5 minutes old if testing old timestamp)
  const ts = test.oldTimestamp
    ? Math.floor((Date.now() - (5.5 * 60 * 1000)) / 1000).toString()
    : Math.floor(Date.now() / 1000).toString();

  // Generate signature
  let signature = generateSignature(ts, bodyString, HMAC_SECRET);

  // Tamper with signature if testing invalid signature
  if (test.tamper) {
    signature = signature.slice(0, -1) + 'X'; // Change last character
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${test.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Timestamp: ${ts}`);
  console.log(`Body: ${bodyString}`);
  console.log(`Signature: ${signature}`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': ts,
        'X-Signature': signature
      },
      body: bodyString
    });

    const responseText = await response.text();

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log(`Response Body: ${responseText}`);

    // Validate expected result
    if (test.tamper || test.oldTimestamp) {
      if (response.status === 401) {
        console.log('✓ Test PASSED - Correctly rejected invalid request');
      } else {
        console.log('✗ Test FAILED - Should have returned 401');
      }
    } else {
      if (response.status >= 200 && response.status < 300) {
        console.log('✓ Test PASSED - Valid request accepted');
      } else {
        console.log('✗ Test FAILED - Valid request should have succeeded');
      }
    }
  } catch (error) {
    console.error(`✗ Test FAILED with error: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('HMAC Signature Verification Test Suite');
  console.log('======================================');
  console.log(`Function URL: ${FUNCTION_URL}`);
  console.log(`HMAC Secret: ${HMAC_SECRET.slice(0, 8)}...${HMAC_SECRET.slice(-8)}`);

  if (FUNCTION_URL.includes('YOUR_PROJECT_REF')) {
    console.error('\n❌ ERROR: Please set FUNCTION_URL environment variable or update the script');
    console.log('\nExample:');
    console.log('  FUNCTION_URL=https://abc123.functions.supabase.co/quick-battles-sync node test-hmac.js');
    process.exit(1);
  }

  for (const test of tests) {
    await runTest(test);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('All tests completed!');
  console.log(`${'='.repeat(60)}\n`);
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with native fetch support');
  console.log('Please upgrade Node.js or use node-fetch');
  process.exit(1);
}

main().catch(console.error);
