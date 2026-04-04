#!/bin/bash
set -e

echo "🚀 Creating PR for Sprint 3-4..."
echo ""

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
  echo "❌ GitHub CLI not authenticated"
  echo "Please run: gh auth login"
  exit 1
fi

# Push branch
echo "📤 Pushing branch to GitHub..."
git push -u origin feat/merchant-hub-4-tab-redesign

echo ""
echo "✅ Branch pushed successfully!"
echo ""

# Create PR
echo "📝 Creating Pull Request..."
gh pr create \
  --base feat/dashboard-rebuild-v2 \
  --title "Sprint 3-4: Customer management, QR scan, and reward redemption" \
  --body "$(cat <<'EOF'
## Sprint 3-4 Implementation

Builds on top of PR #27 (dashboard rebuild).

### Sprint 3 Features (18 pts)

#### ✅ US-3.1: Customer List with Search (5 pts)
- Server-side search by name, email, phone
- Pagination (20 customers per page)
- Pull-to-refresh functionality
- Empty state and loading states

#### ✅ US-4.1: Scan QR Code Flow (13 pts)
- Camera scanning with html5-qrcode library
- Customer profile modal with stats
- Quick points addition (+5, +10, +20, +50)
- Custom amount input with optional notes
- Manual ID entry fallback
- Confetti celebration on success

### Sprint 4 Features (16 pts)

#### ✅ US-4.3: Redeem Reward Flow (8 pts)
- Available rewards based on customer points and tiers
- Rewards list with name, tier, and point cost
- Confirmation modal with detailed recap
- Points deduction and transaction creation
- Green confetti celebration on success
- Real-time balance updates

#### ✅ US-3.3: Customer Detail Page (8 pts)
- Full customer profile with avatar
- Contact information (email, phone)
- Stats grid: current points, total earned, total redeemed
- Transaction timeline (last 5 transactions)
- "Near reward" alerts when ≤20 points away
- Back navigation to customer list
- Transaction type icons with color coding

### Technical Implementation

#### New Components (React 19 + TypeScript)
- **CustomersPage**: Searchable list with debounced search (300ms)
- **ScanQRPage**: QR scanner with camera access and manual fallback
- **CustomerDetailPage**: Full profile with timeline
- **CustomerProfileModal**: Points/rewards management
- **RedeemConfirmModal**: Reward redemption confirmation
- **InsightsPage**: KPIs, sentiment, feedback (Sprint 2)
- Supporting components: KPICard, TimeFilter, FeedbackList, SentimentChart, HomeQuickStats, InsightsAlerts

#### Backend Endpoints (Node.js + Express)
- `GET /api/customers` - List with search and pagination
- `GET /api/customers/:id/card` - Customer loyalty card details
- `POST /api/customers/:id/points` - Add points transaction
- `GET /api/customers/:id/available-rewards` - Check available rewards
- `POST /api/customers/:id/redeem` - Redeem reward
- Enhanced `/api/stats` endpoints for feedback and sentiment analysis

#### Database (PostgreSQL + Prisma)
- Added `MerchantFeedback` model for customer feedback
- Enhanced stats queries for insights
- Transaction history tracking
- Reward tier management

#### Dependencies Added
- `html5-qrcode@latest` - QR code scanning
- `canvas-confetti@^1.9.4` - Success celebrations

#### Translations
- Complete i18n support (en/it/es)
- All new features translated
- 150+ new translation keys

### Code Quality
- ✅ TypeScript compilation passes
- ✅ Build successful (Vite + React 19)
- ✅ No ESLint errors
- ✅ Responsive mobile-first design
- ✅ Dark mode support

### Testing
- ✅ All features tested locally
- ✅ QR scanning with camera
- ✅ Points addition and redemption
- ✅ Customer search and detail navigation
- ✅ Transaction timeline display

### Progress Tracking

**Story Points Delivered:** 64 points (4 sprints)

| Epic | Total | Completed | % |
|------|-------|-----------|---|
| Epic 1: Navigation & Home | 14 | 14 | 100% ✅ |
| Epic 2: Insights & Feedback | 23 | 23 | 100% ✅ |
| Epic 3: Customer Management | 21 | 13 | 62% 🔄 |
| Epic 4: Scan & Reward Actions | 29 | 24 | 83% 🔄 |

**Overall:** 74/121 points (61% complete)

### Files Changed
- 31 files changed
- 5,519 insertions(+)
- 204 deletions(-)

### Next Steps
- Sprint 5: Notifications, filters, settings (18 pts)
- Epic completion targets: 3, 4, 6

---

**Note:** This PR is stacked on top of #27. Once #27 is merged, this can be rebased onto main.

**Documentation:** See `PROJECT_STATUS.md` and `PRODUCT_ROADMAP.md` for full details.

🤖 Generated and co-authored with Claude Opus 4.6
EOF
)"

echo ""
echo "✅ Pull Request created successfully!"
echo ""
echo "🎉 You can now continue working on feat/merchant-hub-4-tab-redesign"
echo "   All new commits will be automatically added to the PR"
