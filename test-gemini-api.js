// test-gemini-api.js
// Quick script to test Gemini API key from .env.local

require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
  console.log('🔍 Testing Gemini API Key...\n');

  // Check if API key exists
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('✅ API key found:', apiKey.substring(0, 10) + '...' + apiKey.slice(-4));
  console.log('📏 Key length:', apiKey.length, 'characters\n');

  try {
    // Initialize the API
    const genAI = new GoogleGenerativeAI(apiKey);

    // Test 1: gemini-3-pro-preview
    console.log('🧪 Test 1: Testing gemini-3-pro-preview model...');
    const proModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
    const proResult = await proModel.generateContent('Say "Hello" if you can hear me.');
    const proText = proResult.response.text();
    console.log('✅ gemini-3-pro-preview response:', proText.substring(0, 50) + '...\n');

    // Test 2: Rate limit test (multiple quick requests)
    console.log('🧪 Test 2: Testing rate limits (5 quick requests)...');
    const promises = Array.from({ length: 5 }, (_, i) =>
      proModel.generateContent(`Test request ${i + 1}`)
    );
    await Promise.all(promises);
    console.log('✅ All 5 requests succeeded\n');

    console.log('🎉 All tests passed! Your Gemini API key is working correctly.');
  } catch (error) {
    console.error('❌ Error testing Gemini API:\n');

    if (error.message?.includes('503')) {
      console.error('  Issue: API is overloaded (503 Service Unavailable)');
      console.error('  Solution: Wait a few minutes and try again. This is a temporary Google server issue.');
    } else if (error.message?.includes('429')) {
      console.error('  Issue: Rate limit exceeded (429 Too Many Requests)');
      console.error('  Solution: Wait before making more requests, or upgrade your API tier.');
    } else if (error.message?.includes('400') || error.message?.includes('API key')) {
      console.error('  Issue: Invalid API key (400 Bad Request)');
      console.error('  Solution: Check that your GOOGLE_AI_API_KEY is correct in .env.local');
    } else {
      console.error('  Error details:', error.message);
    }

    console.error('\n  Full error:', error);
    process.exit(1);
  }
}

testGeminiAPI();
