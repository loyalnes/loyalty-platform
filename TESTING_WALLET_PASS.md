# Wallet Pass Testing Guide

## Quick Start

### 1. Local Development Setup

```bash
# 1. Setup environment
cp .env.example .env

# 2. Add required credentials to .env:
# WALLETWALLET_API_KEY=ww_test_your_key_here
# GOOGLE_WALLET_ISSUER_ID=your_issuer_id
# GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=wallet@your-project.iam.gserviceaccount.com
# GOOGLE_WALLET_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# PUBLIC_URL=http://localhost:3000

# 3. Start services
docker-compose up -d
npm run dev

# 4. Build dashboard
cd dashboard
npm install
npm run build
cd ..
```

### 2. Test Flow - Customer Journey

#### A. Gamification → Claim Prize
1. Navigate to: `http://localhost:3000/app/play/{merchantId}/{campaignId}`
2. Play gamification (scratch card / spin wheel)
3. Win a prize
4. After claim, verify you see:
   - ✅ "My Loyalty Page" button
   - ✅ "Add to Apple Wallet" (if on iPhone Safari)
   - ✅ "Add to Google Wallet" (if on Android)

#### B. Test Apple Wallet (iPhone/Safari only)
1. Open gamification on **real iPhone with Safari**
2. Claim prize
3. Click "Add to Apple Wallet"
4. Should download a `.pkpass` file
5. Tap to add to Wallet app
6. Verify pass shows:
   - Merchant name
   - Customer name
   - Points balance
   - Tier
   - QR barcode

#### C. Test Google Wallet (Android only)
1. Open gamification on **real Android device**
2. Claim prize
3. Click "Add to Google Wallet"
4. Should redirect to Google Pay save URL
5. Add to wallet
6. Verify pass shows loyalty card details

#### D. Test Private Loyalty Page
1. Click "My Loyalty Page" button
2. Should open: `/app/loyalty/{accessToken}`
3. Verify page shows:
   - Points balance
   - Current tier
   - Active prizes with expiration
   - Recent history
   - Missions section

### 3. Test Flow - Merchant Scan

#### A. Desktop Browser (Merchant Dashboard)
1. Login to dashboard: `http://localhost:3000/dashboard/login`
2. Navigate to scan page
3. Test with **Customer QR code** (old format):
   - Scan QR from `/app/customer/{customerId}`
   - Should resolve to customer profile
4. Test with **Wallet barcode token** (new format):
   - Get barcode from wallet pass
   - Scan opaque token string
   - Should resolve to customer profile with wallet context

#### B. Verify Merchant Actions
After scan, merchant should be able to:
- ✅ View points balance
- ✅ Add points
- ✅ Redeem reward tiers
- ✅ See active prizes
- ✅ View recent history

### 4. API Testing

#### Test Scan Resolution
```bash
# 1. Get merchant API key
MERCHANT_KEY="your_merchant_api_key"

# 2. Test scan resolve
curl -X POST http://localhost:3000/api/wallet/scan/resolve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MERCHANT_KEY" \
  -d '{"barcodeToken":"SCAN_TOKEN_FROM_PASS"}'

# Expected response:
# {
#   "walletPassId": "...",
#   "loyaltyCardId": "...",
#   "customerName": "...",
#   "pointsBalance": 240,
#   "tierName": "Gold",
#   "activePrizes": [...],
#   "availableRewards": [...],
#   "recentHistory": [...]
# }
```

#### Test Customer Access
```bash
# 1. Get access token from claim response
ACCESS_TOKEN="customer_access_token_here"

# 2. Test loyalty page data
curl http://localhost:3000/api/wallet/access/$ACCESS_TOKEN

# 3. Test Apple Wallet pass generation
curl http://localhost:3000/api/wallet/access/$ACCESS_TOKEN/apple-pass \
  -o test-pass.pkpass

# 4. Test Google Wallet pass URL
curl http://localhost:3000/api/wallet/access/$ACCESS_TOKEN/google-pass
# Returns: {"saveUrl":"https://pay.google.com/gp/v/save/..."}
```

### 5. Preview Deployment Testing

#### Access Preview
```bash
# PR #29 preview URL:
https://pr-29.preview.loyali.online

# Or check latest PR preview:
gh pr view 29 --json url,statusCheckRollup
```

#### Test on Real Devices
1. **iPhone + Safari:**
   - Visit preview URL on iPhone
   - Complete gamification flow
   - Test Apple Wallet add flow
   - Verify pass appears in Wallet app
   - Test barcode scan from pass

2. **Android Device:**
   - Visit preview URL on Android
   - Complete gamification flow
   - Test Google Wallet add flow
   - Verify pass appears in Google Pay
   - Test barcode scan from pass

### 6. Validation Checklist

#### ✅ Backend
- [ ] TypeScript compiles without errors
- [ ] Dashboard builds successfully
- [ ] ESLint passes
- [ ] API endpoints respond correctly
- [ ] Database migrations applied

#### ✅ Apple Wallet
- [ ] Pass generates successfully
- [ ] QR barcode contains scan token
- [ ] Pass shows merchant name
- [ ] Pass shows customer name
- [ ] Pass shows points balance
- [ ] Pass shows tier name
- [ ] Pass shows active prizes count
- [ ] Pass shows nearest expiration

#### ✅ Google Wallet
- [ ] Save URL generates successfully
- [ ] JWT signing works
- [ ] Pass object has barcode
- [ ] Pass shows loyalty points
- [ ] Pass has link to loyalty page

#### ✅ Customer Flow
- [ ] Gamification claim works
- [ ] Wallet CTAs appear correctly
- [ ] Device detection works (iOS/Android)
- [ ] Loyalty page loads with token
- [ ] Loyalty page shows all data

#### ✅ Merchant Flow
- [ ] Dashboard scan page works
- [ ] Customer QR codes resolve
- [ ] Wallet barcodes resolve
- [ ] Customer profile modal shows
- [ ] Add points works
- [ ] Redeem rewards works

### 7. Known Limitations in MVP

- **No push updates**: Pass doesn't auto-update after points change
- **Manual refresh**: Customer must re-add pass to see updates
- **Placeholder branding**: Using generic placeholder images
- **No auto-triggers**: Pass regeneration is on-demand only

### 8. Troubleshooting

#### Apple Wallet pass doesn't download
- Check `WALLETWALLET_API_KEY` is set correctly
- Verify API key has correct permissions
- Check backend logs for WalletWallet API errors

#### Google Wallet fails
- Verify service account credentials are valid
- Check `GOOGLE_WALLET_ISSUER_ID` matches your Google Cloud project
- Ensure Wallet API is enabled in Google Cloud Console

#### Merchant scan doesn't work
- Verify barcode token is not empty
- Check merchant is authenticated
- Verify wallet pass belongs to merchant's customer

#### Loyalty page shows error
- Verify access token is valid and active
- Check token hasn't been revoked
- Verify wallet pass exists in database

### 9. Next Steps After MVP Testing

1. **Replace placeholder assets:**
   - Add real merchant logo
   - Add branded thumbnail
   - Add branded strip image

2. **Enable auto-refresh:**
   - Wire pass regeneration after points add
   - Wire pass regeneration after reward redeem
   - Wire pass regeneration after prize claim

3. **Production validation:**
   - Test with real merchant accounts
   - Test with real customer data
   - Monitor WalletWallet API usage
   - Monitor Google Wallet API usage

4. **Performance testing:**
   - Load test pass generation
   - Monitor database query performance
   - Test concurrent scan resolution
