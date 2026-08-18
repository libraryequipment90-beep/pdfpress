# OAuth Sign-In Setup Guide (Google + Facebook)

This guide explains how to enable real Google and Facebook sign-in on PDFpress.
You must create your own OAuth apps on each provider (free) and configure the
server with the credentials. No credentials are ever stored in the frontend.

---

## 1. Required environment variables

Create a file `server/.env` by copying `server/.env.example`:

```bash
cp server/.env.example server/.env
```

| Variable | Required for | Where to get it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google sign-in | Google Cloud Console (section 2) |
| `GOOGLE_CLIENT_SECRET` | Google sign-in | Google Cloud Console (section 2) |
| `FACEBOOK_APP_ID` | Facebook sign-in | Facebook for Developers (section 3) |
| `FACEBOOK_APP_SECRET` | Facebook sign-in | Facebook for Developers (section 3) |
| `PUBLIC_URL` | Recommended | Your public site URL, e.g. `https://5173-86bea005b7af8f89.monkeycode-ai.live` |
| `SESSION_SECRET` | Optional | Any long random string used to sign session cookies |

> **`PUBLIC_URL`** is used to build the OAuth callback URLs. If it is not set,
> the server derives the callback URL from the incoming request. Set it to your
> deployed/preview domain so callbacks always match the exact redirect URI you
> register below. There is no leading-slash trailing slash.

> The real **PDF compression** works regardless of whether OAuth is configured.
> When a provider is not configured, its button on the sign-up page is disabled
> and the page says "not configured" instead of showing a fake login.

---

## 2. Create a Google OAuth app

1. Go to https://console.cloud.google.com/ and sign in.
2. Create a project (or select an existing one).
3. Open **APIs & Services → OAuth consent screen**:
   - Choose **External** (or Internal if using a Google Workspace domain).
   - Fill the required app name and support email.
   - Under **Scopes**, add `.../auth/userinfo.email` and `.../auth/userinfo.profile`
     (or just save — the app requests them at runtime).
   - Publish the app (Testing status works for your own account).
4. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `PDFpress`
   - Under **Authorized redirect URIs**, add EXACTLY:
     - Dev/current preview: `https://5173-86bea005b7af8f89.monkeycode-ai.live/api/auth/google/callback`
     - Production (when you deploy): `https://<your-production-domain>/api/auth/google/callback`
   - Click **Create**.
5. Copy the **Client ID** and **Client Secret** shown on the next screen into
   `server/.env`:

```env
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> The redirect URI you enter must match the callback URL the app uses,
> character for character.

---

## 3. Create a Facebook OAuth app

1. Go to https://developers.facebook.com/apps and sign in with a Facebook account.
2. Click **Create App** → use the app type **Authenticate and request data from
   users with Facebook Login** (or select "Facebook Login" as the use case).
3. Fill in the app name and contact email, create the app.
4. In the left menu under **Products**, find **Facebook Login** → **Settings**.
5. Under **Valid OAuth redirect URIs**, add EXACTLY:
   - Dev/current preview: `https://5173-86bea005b7af8f89.monkeycode-ai.live/api/auth/facebook/callback`
   - Production (when you deploy): `https://<your-production-domain>/api/auth/facebook/callback`
6. In the left menu, open **App Settings → Basic** and copy the **App ID** and
   **App Secret** into `server/.env`:

```env
FACEBOOK_APP_ID=1234567890123456
FACEBOOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** Facebook requires an app in **Live** mode (or a Test App with a test
> user) to return emails to all users. A newly created app in Development mode
> will return the email only for the app admins/developers/test users.

---

## 4. Production domain change

When you move to a different domain:

1. Set `PUBLIC_URL` in `server/.env` to the new domain, e.g.
   `PUBLIC_URL=https://pdfpress.example.com`.
2. Add the matching redirect URIs to Google (`/api/auth/google/callback`) and
   Facebook (`/api/auth/facebook/callback`) consoles.

---

## 5. How it works / how to verify

- `GET /api/auth/google` → redirects to Google's consent screen.
- `GET /api/auth/google/callback` → verifies the code + state, stores the user,
  then redirects to `/signup?success=1`.
- Same pattern for `/api/auth/facebook` and `/api/auth/facebook/callback`.
- `GET /api/auth/me` → `{ "user": { provider, id, name, email, photo } }`
  or `{ "user": null }` when not logged in.
- `POST /api/auth/logout` → destroys the server-side session.
- `GET /api/auth/config` → `{ google: { enabled }, facebook: { enabled } }`.

Only the provider, provider ID, name, email and profile picture are stored —
never the access token or secret. Sessions are kept server-side in signed,
HttpOnly cookies.

To run the automated end-to-end test of both flows (uses a local mock OAuth
provider; no real credentials needed):

```bash
cd server && node test-oauth.js
```

---

## Security rules

- Never put client secrets in the frontend (`index.html`, `signup.html`,
  `src/`). The only credential the browser ever sends is your Client/App ID
  (public by design) inside the authorization redirect URL.
- `server/.env` is ignored by git (see `.gitignore`) — do not commit it.
- Keep `SESSION_SECRET` long and random, and never share it.
