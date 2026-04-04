# Steve Picton — PropTech Portfolio State
Last updated: 6 April 2026

## Products

### WhatCanIBuild — whatcanibuild.com.au
- Repo: stevenpicton1979/whatcanibuild
- Live: whatcanibuild.com.au
- Stack: Vanilla HTML/CSS/JS + Vercel serverless Node.js
- Stripe: LIVE mode, $19.99 AUD, webhook on checkout.session.completed
- Supabase: fzykfxesznyiigoyeyed, table: wcib_reports
- Resend: sending from hello@clearoffer.com.au (temporary)
- Staging branch: exists, uses test Stripe keys
- Status: LAUNCHED

### ZoneIQ — zoneiq.com.au
- Repo: stevenpicton1979/zoneiq
- Live: zoneiq.com.au + zoneiq-sigma.vercel.app
- Stack: Next.js 14 + Vercel + Supabase PostGIS
- Coverage: Brisbane, Gold Coast, Moreton Bay, Sunshine Coast = 175,049 polygons
- Overlays: flood, character, schools, bushfire (Sprint 8 building)
- RapidAPI: listed and public, proxy auth working
- Status: LAUNCHED on RapidAPI, Sprint 8 building

### ClearOffer — clearoffer.com.au
- Repo: stevenpicton1979/buyerside
- Live: clearoffer.com.au + buyerside.stevenpicton.ai
- Stack: Vanilla HTML/CSS/JS + Vercel serverless Node.js
- Stripe: test mode only
- Status: HOLDING — waiting Domain API + PropTechData approvals

## Infrastructure
- Supabase project: fzykfxesznyiigoyeyed
- Tables: zone_geometries, zone_rules, flood_overlays, character_overlays, school_catchments, bushfire_overlays, wcib_reports, api_keys, api_usage
- Vercel team: stevenpicton1979s-projects
- VentraIP domains: zoneiq.com.au, whatcanibuild.com.au, clearoffer.com.au (all live)
- Stripe: same account, WhatCanIBuild live, ClearOffer test
- Resend: clearoffer.com.au verified (free tier, 1 domain limit)
- RapidAPI: ZoneIQ listed, public

## Overnight build system
- Each repo has BACKLOG.md — Claude Code reads and executes tasks autonomously
- Start: claude --dangerously-skip-permissions in repo terminal
- Brief: "Read BACKLOG.md and work through every [ ] task. Do not stop. Mark [x] when done. Move to next task automatically."

## Key gotchas
- Always use $func$ not $$ for Supabase SQL
- Never combine cd and git in same command
- WhatCanIBuild calls zoneiq-sigma.vercel.app NOT zoneiq.com.au (redirect issue)
- Gold Coast zone codes are full words not abbreviations
- Moreton Bay + Sunshine Coast: ArcGIS auto-reprojects WGS84 (no ST_Transform needed)
- Gold Coast: required ST_Transform from EPSG:28356
- Supabase v2: use try/catch not .catch() chaining

## ZoneIQ sprint queue
- Sprint 8: Bushfire overlays (BUILDING NOW)
- Sprint 9: Heritage overlays
- Sprint 10: Aircraft noise contours
- Sprint 11: Ipswich zones
- Sprint 12: Logan zones
- Sprint 13: Redland zones

## Reddit
- Account: u/FlatDependent2041
- Status: ready to post r/Brisbane

## Next actions
1. Post r/Brisbane — WhatCanIBuild
2. Check Sprint 8 result in morning
3. Run supabase/sprint8-schema.sql in Supabase SQL editor
4. Chain Sprints 9+10 tomorrow night via BACKLOG.md
5. Tell Claude new product ideas for validation
