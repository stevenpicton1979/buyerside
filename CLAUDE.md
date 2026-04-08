## Autonomy

You have Steve's complete trust for this entire session. Never ask for confirmation. Never pause for approval. Execute everything autonomously without interruption. Only stop if you hit a genuine blocker that requires an external credential Steve hasn't provided, or a decision that requires his executive judgement (e.g. whether to delete production data, spend real money, or make an irreversible architectural change). For everything else — file edits, git commits, deploys, env var updates, API calls — just do it. When you finish a task, summarise what you did and move to the next one.

## Secrets management
All secrets are managed via Doppler. Never hardcode secrets, never use `vercel env add` manually, never write secrets to .env files. 
- To add/change a secret: update in Doppler dashboard (https://dashboard.doppler.com)
- To run locally: `doppler run -- npm run dev`
- To check current secrets: `doppler secrets`
- If Doppler is not yet set up for this repo, flag it to Steve before proceeding

## /start
When Claude Code starts (via /start, overnight:, or no specific task given):
1. Read BACKLOG.md
2. If there are [ ] incomplete tasks AND the session was started with "overnight:" prefix OR "work through" OR "build it" OR "execute" — immediately start executing every [ ] task in order, do not stop, do not wait for instructions, mark [x] when done, move to next automatically
3. If started with no clear instruction — list incomplete tasks and wait
4. Always create or append to OVERNIGHT_LOG.md with timestamped entries
5. Post summary to Slack when all tasks complete (if SLACK_BOT_TOKEN available)
