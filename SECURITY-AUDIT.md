# Security / loophole audit — implementation pass

## Pass 1 findings and fixes

### 1. Room password bypass
**Risk:** a client could insert itself into `game_players` directly and skip the password check.
**Fix:** removed authenticated INSERT policy from `game_players`. Membership is created only by `join_game()` after verifying the password hash.

### 2. Raw vote injection
**Risk:** a client could insert a vote row directly and bypass exact vote count, target validation, and round deadline.
**Fix:** removed authenticated INSERT policy from `votes`. Votes can only be written through `submit_votes()`.

### 3. Password-hash disclosure
**Risk:** storing `password_hash` on a client-readable `games` row would expose password material.
**Fix:** moved the hash to `game_secrets`, which has no authenticated SELECT policy. The browser only receives safe game metadata.

### 4. Direct game mutation
**Risk:** a client could create or modify a game without passing the application's validation.
**Fix:** removed direct INSERT/UPDATE/DELETE policies on `games`. Creation and starting are controlled by SECURITY DEFINER RPCs.

### 5. Unauthorized round closing
**Risk:** any authenticated player could force an expired round into results.
**Fix:** `close_round()` requires the game's host and also requires the server deadline to have passed.

### 6. Vote-target duplication
**Risk:** submitting the same target repeatedly could inflate its vote count.
**Fix:** `submit_votes()` rejects a duplicate target because the unique vote row exists within the same transaction.

### 7. Authentication bypass
**Risk:** client-only localStorage authentication could falsely appear to secure gameplay routes.
**Fix:** the demo fallback was removed. Middleware requires a valid Supabase Auth session before protected routes are served.

### 8. Sign-out bug
**Risk:** simply navigating to `/auth` would leave the Supabase session active.
**Fix:** the app shell now calls `supabase.auth.signOut()` before redirecting.

### 9. Room-code/password brute force
**Risk:** unlimited password attempts could be used against a known room code.
**Fix:** `room_join_attempts` limits a user to 10 attempts per room code per 10 minutes. Production should additionally use edge/WAF rate limiting.

### 10. Ranking semantics
**Risk:** the UI asks players to select the least trustworthy players, but a descending vote sort would reward being voted least trustworthy.
**Fix:** ranking now sorts by **fewest least-trustworthy votes first**, with deterministic tie-breaking.

## Remaining production controls
- Supabase email confirmation / password reset must be configured.
- Add IP/device-aware rate limiting at the edge; database user-level throttling alone is not enough against many-account abuse.
- Add a trusted scheduled worker using the service role to close expired rounds. The SQL function still rejects early closure.
- Add server-side authorization checks to every future RPC.
- Add audit logs for host actions and moderation actions.
- Never expose `service_role` keys to the browser.

### 11. RLS recursion audit
**Risk:** policies that queried `game_players` from inside `game_players` RLS could recursively invoke themselves.
**Fix:** membership checks were moved to a small SECURITY DEFINER helper, `is_game_member()`, and policies call that helper instead of recursively querying the protected table.

## Pass 2 — deployment-readiness audit

### 12. Multiple vote-submission loophole
**Risk found:** `submit_votes()` validated the number of targets in each request, but did not previously reject a second submission in the same round. A player could submit one valid batch and then another different batch, exceeding the configured vote allowance.
**Fix:** `submit_votes()` now rejects any round where that authenticated voter already has vote rows. The first accepted submission is the only submission for that player in that round.

### Deployment review
- No Supabase service-role key is present in the frontend or environment template.
- Room passwords remain server-side hashes in `game_secrets`.
- Protected routes continue to require Supabase Auth through middleware.
- Cloudflare deployment should use Workers rather than Pages Static HTML Export because the app uses middleware and dynamic authenticated state.
- Final production build could not be executed in this environment because dependency installation timed out; deployment configuration was therefore kept minimal rather than introducing an unnecessary framework migration.
