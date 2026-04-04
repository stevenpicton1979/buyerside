# Steve Picton — PropTech Portfolio State
Last updated: 6 April 2026 (evening)

## Products

### WhatCanIBuild — whatcanibuild.com.au
- Repo: stevenpicton1979/whatcanibuild
- Live: whatcanibuild.com.au
- Stack: Vanilla HTML/CSS/JS + Vercel serverless Node.js
- Stripe: LIVE mode, $19.99 AUD, webhook on checkout.session.completed
- Supabase: fzykfxesznyiigoyeyed, table: wcib_reports
- Resend: sending from hello@clearoffer.com.au (temporary)
- Staging branch: exists, uses test Stripe keys (Preview env vars in Vercel)
- Status: LAUNCHED — posted on r/Brisbane today
- Known issues: ZoneIQ URL must be zoneiq-sigma.vercel.app not zoneiq.com.au (redirect issue on server-side fetch)

### ZoneIQ — zoneiq.com.au
- Repo: stevenpicton1979/zoneiq
- Live: zoneiq.com.au + zoneiq-sigma.vercel.app
- Stack: Next.js 14 + Vercel + Supabase PostGIS
- Coverage: Brisbane, Gold Coast, Moreton Bay, Sunshine Coast = 175,049 polygons
- Overlays: flood, character, schools, bushfire (Sprint 8 built overnight)
- RapidAPI: listed and public, proxy auth working, RAPIDAPI_PROXY_SECRET in Vercel env
- API keys: working, stored in api_keys table
- Status: LAUNCHED on RapidAPI

### ClearOffer — clearoffer.com.au
- Repo: stevenpicton1979/buyerside (main branch, not master)
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
- RapidAPI: ZoneIQ listed, public, Basic/Pro/Ultra tiers

## Overnight build system
- Each repo has BACKLOG.md — Claude Code reads and executes tasks autonomously
- Start: claude --dangerously-skip-permissions in repo terminal
- Brief: "Read BACKLOG.md and work through every [ ] task. Do not stop. Mark [x] when done. Move to next task automatically."
- OVERNIGHT_LOG.md created per session with timestamps
- Trusted domains added to CLAUDE.md to avoid fetch permission prompts

## Key gotchas
- Always use $func$ not $$ for Supabase SQL
- Never combine cd and git in same command
- WhatCanIBuild calls zoneiq-sigma.vercel.app NOT zoneiq.com.au (redirect issue on server-side fetch)
- Gold Coast zone codes are full words not abbreviations
- Moreton Bay + Sunshine Coast: ArcGIS auto-reprojects WGS84 (no ST_Transform needed)
- Gold Coast: required ST_Transform from EPSG:28356
- Supabase v2: use try/catch not .catch() chaining
- buyerside repo uses main branch not master
- Vercel preview deployments need test Stripe keys scoped to Preview environment

## ZoneIQ sprint queue (see BACKLOG.md for full list)
- Sprint 8: Bushfire overlays (DONE)
- Sprint 9: Heritage overlays (next)
- Sprint 10: Aircraft noise contours
- Sprint 11-13: Ipswich, Logan, Redland zones

## New product ideas being evaluated
- SubdivideIQ: subdivision feasibility pre-screen. User enters address, gets traffic light report (Green/Amber/Red) covering zone rules, lot size, flood/drainage risk, easements, sewer access, slope. $49-99. Prevents wasted spend on surveyors and hydraulics engineers for non-viable sites. Steve has personal experience — wasted $7.5k on failed subdivision attempt.
- Dataset opportunities: contaminated land, heritage registers, aircraft noise, DAs, powerline easements, acid sulfate soils

## Reddit
- Account: u/FlatDependent2041
- Posted: r/Brisbane — "Built a tool to check planning rules for any Brisbane property"
- URL: check reddit.com/user/FlatDependent2041
- Next: r/AusPropertyChat when karma is higher

## How to start a new Claude chat with full context
Open new chat at claude.ai and paste:
"Read my current project state from GitHub before we start: https://raw.githubusercontent.com/stevenpicton1979/buyerside/main/STATE.md — I'm Steve, building a PropTech portfolio. Once you've read it confirm you're up to speed."
