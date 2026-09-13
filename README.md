# Pyramid Game

A production-oriented multiplayer social strategy game based on the supplied UI/brand references.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL + Realtime
- Tailwind CSS v4
- Lucide icons

## Required security model
1. Authentication is mandatory for every gameplay route.
2. Every room has a password; the room code alone is insufficient.
3. Room passwords are stored as bcrypt hashes via PostgreSQL `crypt` and never returned to the client.
4. Raw vote rows have no SELECT policy, so clients cannot inspect who voted for whom.
5. Vote submission is performed through a server-side SECURITY DEFINER function that validates membership, deadline, exact vote count, target membership, and duplicates.
6. Rankings are generated server-side; the browser cannot authoritatively set rank/score.

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key.
4. Run `npm install`.
5. Run `npm run dev`.


## GitHub + Cloudflare deployment

This project is a dynamic Next.js application, so deploy it to **Cloudflare Workers**, not Cloudflare Pages Static HTML Export. Cloudflare's current Workers flow can automatically detect an existing Next.js repository and configure the Cloudflare adapter during setup. Cloudflare currently recommends its `vinext` path for new Next.js Workers deployments; the app does not need a source-code migration just to be connected to GitHub and prepared for that setup.

### 1. Push to GitHub

Create a private or public GitHub repository and push this project. **Do not commit `.env.local` or any Supabase service-role key.**

### 2. Connect the repository to Cloudflare

In Cloudflare, use **Workers & Pages → Create application → Workers** and connect the GitHub repository. Let Cloudflare's automatic framework configuration detect Next.js. Cloudflare Workers Builds can run the build and deploy commands from the repository.

### 3. Add build environment variables

Set these in the Cloudflare Worker/Workers Build environment:

```text
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The Supabase **anon/publishable** key is intended for browser use. Never put the Supabase `service_role` key in `NEXT_PUBLIC_*` variables or in the repository.

### 4. Configure Supabase Auth URLs

After Cloudflare gives the Worker its production URL, add that URL to Supabase Auth's Site URL / redirect configuration. Also add any preview URL you intend to use for authentication testing.

### 5. Run the database schema

Before inviting players, execute `supabase/schema.sql` in the Supabase SQL editor. This creates the RLS policies and server-side game RPCs.

### Important

Use **Cloudflare Workers**, not the Cloudflare Pages `Next.js (Static HTML Export)` preset. This application requires authenticated middleware and dynamic game state.

## Important production hardening
- Configure Supabase Auth email confirmation and password reset.
- Add rate limiting/WAF around auth and RPC calls.
- Add a trusted server/cron worker to close expired rounds automatically. `close_round` itself rejects early calls, so clients cannot close a round prematurely.
- Add Realtime subscriptions for game/round state, with RLS preserved.
- Add moderation/reporting before public matchmaking.

## Security audit performed during implementation
The first pass exposed several privilege-escalation paths and they were removed before packaging:
- Direct client inserts into `game_players` could bypass the room password -> removed; joining is RPC-only.
- Direct client inserts into `votes` could bypass the vote count/deadline -> removed; voting is RPC-only.
- Exposing `password_hash` on `games` would leak password material -> moved to `game_secrets`, which has no client SELECT policy.
- Direct game INSERT/UPDATE could bypass creation rules -> removed; game mutation is RPC-only.
- Round closing was callable by any player -> restricted to the host after the deadline.
