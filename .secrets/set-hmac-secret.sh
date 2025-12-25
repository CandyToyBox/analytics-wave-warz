#!/bin/bash

# Set HMAC_SECRET in Supabase
# This script sets the HMAC secret for your Supabase project

HMAC_SECRET="98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39"

echo "Setting HMAC_SECRET in Supabase..."
supabase secrets set HMAC_SECRET="$HMAC_SECRET"

echo ""
echo "✓ Secret set successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy functions: supabase functions deploy"
echo "2. Test with the provided test script"
