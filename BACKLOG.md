# ClearOffer Backlog

## How this works
Claude Code reads this file at the start of every session and works through tasks marked [ ] from top to bottom. Mark [x] when done. Edit via GitHub.com on your phone.

## Blocked — waiting on external approvals
- [ ] Domain API integration (Listings, Properties, Price Estimation) — pending post-Easter approval
- [ ] PropTechData credentials — emailed hello@proptechdata.com.au, awaiting response

## Ready to build now (unblocked)
- [ ] Add basic smoke tests — test Scout Report loads for a known address, test Buyer's Brief Stripe checkout creates a session. Use Jest + supertest.
- [ ] Replace Scout Report placeholder data with live ZoneIQ API calls
- [ ] Add bushfire overlay to Scout Report — once ZoneIQ Sprint 8 live
- [ ] Improve Scout Report design — trust signals, clearer value prop before $149 paywall
- [ ] Add price anchoring to Buyer's Brief — "A buyer's agent charges $500-2,000. Yours is $149."
- [ ] Switch Stripe to live mode — same process as WhatCanIBuild
- [ ] Add clearoffer.com.au as sending domain in Resend
- [ ] Add Powered by ZoneIQ attribution to Scout Report footer

## Waiting for Domain API approval
- [ ] Wire Domain API listings into Scout Report
- [ ] Wire Domain API price estimate into Scout Report
- [ ] Wire PropTechData into Buyer's Brief
- [ ] Full end-to-end $149 flow test with real data

## Done
- [x] Sprint 1-3: Setup, overlays, rebrand BuyerSide → ClearOffer
- [x] Smart placeholders for missing API data
- [x] Resend email from hello@clearoffer.com.au
- [x] clearoffer.com.au domain live
- [x] Claude AI streaming Buyer's Brief
