# Cardinal’s Nest: Render test deployment

This Blueprint creates a free Node web service and a free PostgreSQL database in Oregon. Use fake test data only. Render's free database expires after 30 days; free web services sleep after 15 minutes without traffic. Upgrade the database and arrange backups before real team use.

1. In Render, select **New → Blueprint**, connect `zgoude6696/cardinals-nest`, and select branch `deploy/render-test`.
2. Use `render.yaml`. Both resources must show the **Free** plan.
3. Set `DEMO_BOOTSTRAP_PASSWORD` to a private, memorable passphrase of at least 12 characters. It is the initial password for all seven demo accounts. Do not put it in GitHub.
4. Deploy. Render generates a session secret and connects the database internally.
5. Wait for the web service to show **Live**, then open its assigned `onrender.com` address.
6. Sign in as `coach_mentor` with your chosen passphrase. Other demo usernames are `team_captain`, `mech_lead`, `sw_lead`, `elec_lead`, `safety_trainer`, and `member1`.

The local `Nest6696` password and local data are not uploaded. Initial passwords are hashed; later deployments do not reset existing accounts. Changing the bootstrap environment variable does not reset an existing password. Use the app’s Change Password screen for that.

The app creates its schema only on a fresh database and retains its existing startup migrations. `/healthz` verifies database connectivity. Push notification and third-party scouting keys are optional and not configured by this Blueprint.

To test certification approval, assign Trainer plus the appropriate department/level scope to a captain or Department Head. Coach/captain role assignment and scope-management permissions remain as inherited; this deployment does not harden those previously discussed permissions.

No custom domain is required for testing. The public team website at team6696.org remains separate.

References: https://render.com/docs/free and https://render.com/docs/blueprint-spec

## Routine updates

The live service uses `zgoude6696/cardinals-nest`, branch `deploy/render-test`.
After testing locally, push that branch; Render's **Auto-Deploy → On Commit**
should build and deploy it. Check **Deploys** for the same commit and a successful
health check, then reload `https://nest.team6696.org`.

If a push does not trigger a deploy, check the existing Render account's
**Account settings → Account Security → Git Deployment Credentials**. It must
have the `zgoude6696` GitHub credential connected, and the Render GitHub app must
have access to `cardinals-nest`. A public repository can still be cloned manually
without this connection, which does not prove auto-deployment is configured.
Fallback: **Manual Deploy → Deploy latest commit**.
