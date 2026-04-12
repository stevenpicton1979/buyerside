## Autonomy

You have Steve's complete trust for this entire session. Never ask for confirmation. Never pause for approval. Execute everything autonomously without interruption. Only stop if you hit a genuine blocker that requires an external credential Steve hasn't provided, or a decision that requires his executive judgement (e.g. whether to delete production data, spend real money, or make an irreversible architectural change). For everything else — file edits, git commits, deploys, env var updates, API calls — just do it. When you finish a task, summarise what you did and move to the next one.

# buyerside (ClearOffer) — Claude Code config

## Session Setup
Always run with --dangerously-skip-permissions behaviour — do not pause for confirmations on file writes, bash commands, or git operations.

## Git Rules
- NEVER combine cd and git in the same command — always separate lines
- NEVER commit after individual files — batch all changes, max 6 commits per sprint
- Complete ALL code changes before any git commands
- This repo uses **main** branch, not master

## Stack
- Vanilla HTML/CSS/JS + Vercel serverless Node.js
- Supabase for persistence, Stripe for payments
- No build step — plain files served directly
- Local dev: vercel dev --listen 3001. Never npm run dev (recursive invocation error).

## Key Files
- api/home.js — root route (reads COMING_SOON env var)
- api/zone-lookup.js — thin wrapper around PropertyData
- api/buyers-brief.js — paid report generation (Claude Sonnet)
- api/lib/propertydata-client.js — THE bridge to PropertyData API (only place that knows PropertyData's response shape)
- api/config.js — server-side product config
- public/js/config.js — client-side copy strings
- vercel.json — routing rules

## State management — mandatory protocol

This repo's state lives in C:\dev\portfoliostate\STATE_CLEAROFFER.md

Before reading state:
  git -C C:\dev\portfoliostate fetch origin
  git -C C:\dev\portfoliostate reset --hard origin/main
  Then read C:\dev\portfoliostate\STATE_CLEAROFFER.md

Never read STATE.md (deprecated). Never write another product's state file.

After completing work, push state before ending the session:
  cd C:\dev\portfoliostate
  git add STATE_CLEAROFFER.md
  git commit -m "state: ClearOffer session update"
  git push

## PropertyData dependency — read before assuming data shapes

This product consumes the PropertyData API. Before writing any data-fetching code,
read the "Upstream dependency" section in STATE_CLEAROFFER.md.
Do not call endpoints or assume fields that are not listed in the contract snapshot.
If a needed field is missing, log it as a blocker — do not silently work around it.

## Secrets management
All secrets are managed via Vercel Environment Variables. Never hardcode secrets, never write secrets to .env files.
- To add/change a secret: update in Vercel dashboard (project → Settings → Environment Variables) or use `vercel env add`
- To run locally: `vercel dev --listen 3001` (pulls env vars from Vercel project automatically)
- To check current secrets: `vercel env ls`

## Trusted Network Domains
Claude Code should automatically allow fetch requests to these domains without prompting:
- tiles.arcgis.com
- services.arcgis.com
- zoneiq-sigma.vercel.app
- maps.googleapis.com
- api.anthropic.com
- api.resend.com
- api.stripe.com

## /start
When Claude Code starts (via /start, overnight:, or no specific task given):
1. Read BACKLOG.md
2. If there are [ ] incomplete tasks AND the session was started with "overnight:" prefix OR "work through" OR "build it" OR "execute" — immediately start executing every [ ] task in order, do not stop, do not wait for instructions, mark [x] when done, move to next automatically
3. If started with no clear instruction — list incomplete tasks and wait
4. Always create or append to OVERNIGHT_LOG.md with timestamped entries
