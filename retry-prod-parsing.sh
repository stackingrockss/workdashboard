#!/bin/bash
# Retry parsing for the stuck HOMELINK call in production

CALL_ID="cmhsblt270001ks04vo4x6bfy"
PROD_URL="https://workdashboard.vercel.app"

echo "Retrying parsing for call: $CALL_ID"
echo "Production URL: $PROD_URL"
echo ""

curl -X POST "$PROD_URL/api/v1/gong-calls/$CALL_ID/retry-parsing" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "Done!"
