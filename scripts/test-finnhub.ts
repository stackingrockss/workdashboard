// scripts/test-finnhub.ts
// Run with: npx tsx scripts/test-finnhub.ts

import { config } from "dotenv";
config({ path: ".env.local" });

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const API_NINJAS_KEY = process.env.API_NINJAS_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const API_NINJAS_BASE_URL = "https://api.api-ninjas.com/v1";
const SEC_FILES_URL = "https://www.sec.gov/files";
const SEC_DATA_URL = "https://data.sec.gov";
const SEC_USER_AGENT = "WorkDashboard test@example.com";

interface EarningsCalendarEvent {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

async function testIntegrations() {
  console.log("=== Earnings Data Integration Test ===\n");
  console.log("Testing: Finnhub, API Ninjas, SEC EDGAR\n");

  // Check configurations
  console.log("1. Checking API configurations...");
  console.log(`   FINNHUB_API_KEY: ${FINNHUB_API_KEY ? "✅ Set" : "❌ Not set"}`);
  console.log(`   API_NINJAS_KEY: ${API_NINJAS_KEY ? "✅ Set" : "❌ Not set"}`);
  console.log("");

  if (!FINNHUB_API_KEY && !API_NINJAS_KEY) {
    console.log("   ❌ No API keys configured. Add keys to .env.local");
    return;
  }

  const testTicker = "AAPL";

  // Test 2: Finnhub earnings calendar
  if (FINNHUB_API_KEY) {
    console.log(`2. Testing Finnhub earnings calendar for ${testTicker}...`);
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);

      const url = `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${testTicker}&from=${today.toISOString().split("T")[0]}&to=${futureDate.toISOString().split("T")[0]}&token=${FINNHUB_API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const earnings: EarningsCalendarEvent[] = data.earningsCalendar || [];

      if (earnings.length > 0) {
        const filtered = earnings.filter(e => e.symbol === testTicker);
        console.log(`   ✅ Found ${filtered.length} earnings events for ${testTicker}`);
        if (filtered[0]) {
          console.log(`   Next earnings: ${filtered[0].date} (${filtered[0].hour})`);
        }
      } else {
        console.log("   ⚠️ No earnings events found in next 90 days");
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.log("2. Skipping Finnhub earnings calendar (no API key)");
  }

  // Test 3: API Ninjas transcript (S&P 100 only on free tier)
  if (API_NINJAS_KEY) {
    console.log(`\n3. Testing API Ninjas transcript for ${testTicker} (S&P 100)...`);
    try {
      const currentYear = new Date().getFullYear();
      const url = `${API_NINJAS_BASE_URL}/earningstranscript?ticker=${testTicker}&year=${currentYear}&quarter=3`;

      const response = await fetch(url, {
        headers: { "X-Api-Key": API_NINJAS_KEY },
      });

      if (response.status === 404) {
        console.log("   ⚠️ Transcript not found (may not be available yet)");
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } else {
        const data = await response.json();
        if (data.transcript) {
          const preview = data.transcript.substring(0, 200).replace(/\n/g, " ");
          console.log(`   ✅ Found transcript for Q${data.quarter} ${data.year}`);
          console.log(`   Preview: ${preview}...`);
        } else {
          console.log("   ⚠️ Empty transcript returned");
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }

    // Test with non-S&P 100 company
    const nonSp100Ticker = "DDOG"; // Datadog - not in S&P 100
    console.log(`\n4. Testing API Ninjas for non-S&P 100 company (${nonSp100Ticker})...`);
    try {
      const currentYear = new Date().getFullYear();
      const url = `${API_NINJAS_BASE_URL}/earningstranscript?ticker=${nonSp100Ticker}&year=${currentYear}&quarter=3`;

      const response = await fetch(url, {
        headers: { "X-Api-Key": API_NINJAS_KEY },
      });

      if (response.status === 404) {
        console.log("   ✅ Expected: 404 - Not S&P 100, transcript not available via API");
        console.log(`   → Manual upload required from Seeking Alpha`);
        console.log(`   → URL: https://seekingalpha.com/symbol/${nonSp100Ticker}/earnings/transcripts`);
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } else {
        const data = await response.json();
        console.log(`   ⚠️ Unexpected: Found transcript (company may be in S&P 100)`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.log("\n3. Skipping API Ninjas transcript test (no API key)");
    console.log("4. Skipping non-S&P 100 test (no API key)");
  }

  // Test 5: SEC EDGAR (no API key needed)
  console.log(`\n5. Testing SEC EDGAR for ${testTicker}...`);
  try {
    // First get CIK
    const tickersResponse = await fetch(`${SEC_FILES_URL}/company_tickers.json`, {
      headers: { "User-Agent": SEC_USER_AGENT },
    });

    if (!tickersResponse.ok) {
      throw new Error(`HTTP ${tickersResponse.status}`);
    }

    const tickersData = await tickersResponse.json();
    const company = Object.values(tickersData).find(
      (c: any) => c.ticker === testTicker
    ) as any;

    if (!company) {
      throw new Error(`Ticker ${testTicker} not found`);
    }

    const cik = String(company.cik_str).padStart(10, "0");
    console.log(`   ✅ Found CIK: ${cik}`);

    // Get submissions
    const submissionsResponse = await fetch(
      `${SEC_DATA_URL}/submissions/CIK${cik}.json`,
      { headers: { "User-Agent": SEC_USER_AGENT } }
    );

    if (!submissionsResponse.ok) {
      throw new Error(`HTTP ${submissionsResponse.status}`);
    }

    const submissions = await submissionsResponse.json();
    const recentFilings = submissions.filings.recent;

    // Find last 10-Q filing
    let lastQuarterlyFiling = null;
    for (let i = 0; i < recentFilings.form.length; i++) {
      if (recentFilings.form[i] === "10-Q" || recentFilings.form[i] === "10-K") {
        lastQuarterlyFiling = {
          form: recentFilings.form[i],
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
        };
        break;
      }
    }

    if (lastQuarterlyFiling) {
      console.log(`   ✅ Last quarterly filing: ${lastQuarterlyFiling.form}`);
      console.log(`   Filing date: ${lastQuarterlyFiling.filingDate}`);
      console.log(`   Report date: ${lastQuarterlyFiling.reportDate}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n=== Test Complete ===");
}

testIntegrations().catch(console.error);
