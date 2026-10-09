# Lenny-app

This Lenny-app is maintained by the ArchiveLabs. which is client app example for [Lenny](https://lennyforlibraries.org)

## Technologies
* [`Turborepo`](https://turborepo.com/) for monorepo management. 
* [`Nextjs`](https://nextjs.org) inside Turborepo.
* [`Tailwindcss`](https://tailwindcss.com) for styling.
* [`Docker`](https://www.docker.com/) for deployment and containerization.
* [`Nginx`](https://nginx.org/) for reverse proxy.

## Architecture

This monorepo contains two Next.js applications:
- **Web** (`apps/web/`) - Main web application
- **Docs** (`apps/docs/`) - Documentation site

Each app has its own Dockerfile and runs independently. A single Nginx reverse proxy routes traffic to both apps on separate ports.

## Endpoints

### Development (without Docker)

* **Web:** [http://localhost:3000/](http://localhost:3000/)
* **Docs:** [http://localhost:3001/](http://localhost:3001/)

### Production (with Docker via Nginx reverse proxy)

* **Web:** [http://localhost:8080/](http://localhost:8080/)
* **Docs:** [http://localhost:8081/](http://localhost:8081/)

## Docker Architecture

### Container Structure
- **web** - Next.js app running on port 3000 inside container
- **docs** - Next.js app running on port 3001 inside container
- **nginx** - Reverse proxy with two server blocks:
  - Port 80 → proxies to `web:3000` (exposed as host port 8080)
  - Port 81 → proxies to `docs:3001` (exposed as host port 8081)

### Nginx Configuration

* **Location:** `docker/nginx.conf`
* **Purpose:** Reverse proxy with two separate server blocks for web and docs apps
* **Features:** 
  - Standard proxy headers for proper request forwarding
  - WebSocket upgrade support for Next.js hot reload
  - Each app served at root path `/` on its own port
  - Debug header `X-Proxy` to identify the Nginx instance

### Dockerfiles

Each app has its own optimized multi-stage Dockerfile:
* **Web:** `apps/web/Dockerfile`
* **Docs:** `apps/docs/Dockerfile`


## Development Setup

### Local Development (without Docker)

1. Install dependencies:
   
   ```bash
   pnpm install
   ```

2. Start the development servers:
   
   ```bash
   pnpm run dev
   ```

   This will start both apps:
   - Web: [http://localhost:3000/](http://localhost:3000/)
   - Docs: [http://localhost:3001/](http://localhost:3001/)

3. Make sure you have your own Lenny setup running on your machine ([installation guide](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation))

   ```bash
   git clone git@github.com:ArchiveLabs/lenny.git
   cd lenny
   ./run.sh --public --preload  
   ```
   
   This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.

## Docker Setup

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+

### Quick Start

Build and start all services (web, docs, and nginx):

```bash
docker compose up --build
```

Or run in detached mode:

```bash
docker compose up --build -d
```

### Docker Commands

#### Build containers

```bash
# Build all services
docker compose build

# Build specific service
docker compose build web
docker compose build docs
```

#### Start/Stop services

```bash
# Start all services
docker compose up

# Start in detached mode (background)
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

#### View logs

```bash
# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# View logs for specific service
docker compose logs web
docker compose logs docs
docker compose logs nginx
```


### Testing Docker Endpoints

Once the containers are running, test the endpoints:

```bash
# Test web app
curl http://localhost:8080/

# Test docs app
curl http://localhost:8081/

# Or open in browser
open http://localhost:8080/
open http://localhost:8081/
```

### Customizing Ports

To change the exposed ports, edit `compose.yaml`:

```yaml
nginx:
  ports:
    - "8080:80"
    - "8081:81"
```


### Lenny Backend Setup

Make sure you have your own Lenny setup running on your machine ([installation guide](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation))

```bash
curl -fsSL https://raw.githubusercontent.com/ArchiveLabs/lenny/refs/heads/main/install.sh | sudo sh
```

This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.

### Using Lenny Web App Outside Docker Container

If you want to use the Lenny web app outside the Docker container (for local development), you need to allow local network IP addresses to upload files.

Add the following code inside the `is_allowed_uploader` function in `code/api.py` within your Lenny instance:

```python
if client_ip.startswith("172.") or client_ip.startswith("192.168."):
    return True
```

This allows upload requests from Docker networks (172.x.x.x) and local networks (192.168.x.x) to bypass the uploader IP restrictions during development.


## Pilot

We're seeking partnerships with libraries who would like to try lending digital resources to their patrons.

## Upgrading the admin app (operators)

Notes for anyone upgrading a working install of `apps/web` (the admin UI served under `/admin`).

### What is new

* **App Access** (Settings → *Apps & readers* → App Access, `/admin/settings/app-access`): manage the reading apps and catalogs that may sign patrons in. Add an app, edit its name / redirect URLs / permissions, turn it on or off, reset a server app's secret, and remove an app that is turned off. A *For developers* tab shows the endpoints an app should use. The old `/settings/connected-apps` and `/connected-apps` URLs redirect there.
* **Patron Sign-in Provider**: the former "External Auth (OIDC)" page, renamed only. Same route (`/settings/external-auth`), same behaviour. It is the opposite direction from App Access: here Lenny signs patrons in with an outside provider; in App Access, apps use Lenny's sign-in.
* **Density and typography** (`apps/web/app/density.css`): the whole admin is scaled by one root font size that depends on the device. Touch screens: 15px on phones, 14px from 768px up. Mouse devices: 16px below 768px, 15px at 768–1023px, 14px at 1024–1919px, 15px at 1920–2559px, 16px from 2560px. Inputs stay 16px and touch controls stay at least 44px tall. The main column is capped at 84rem. Tune the `--root-size-*` variables in that file; nothing else needs to change.
* **Security hardening** of the admin proxy and login (see below).

### Behaviour changes that can break an install

* **The admin proxy (`/api/admin/*`) is stricter.** Paths containing `.` or `..` segments, encoded slashes, `?`, `#`, backslashes or control characters are rejected with 400. A request without the `admin_token` cookie gets 401 from the proxy itself (the internal secret is never attached to anonymous requests), including paths that end in `.json`, `.png`, `.svg` or `.ico`. Upstream redirects are not followed (a 3xx from Lenny becomes a 502).
* **Origin check on state-changing calls.** `POST`/`PUT`/`PATCH`/`DELETE` to `/api/admin/*` and the upload route are rejected with 403 when the browser sends `Sec-Fetch-Site: cross-site`, or an `Origin` whose hostname differs from `X-Forwarded-Host` (or `Host`). Ports are ignored. A reverse proxy in front of the admin app must forward the original `Host` (or `X-Forwarded-Host`). Both known setups do: lenny-app's own `docker/nginx.conf` sends `Host $host` (no port), and Lenny's `docker/nginx/conf.d/lenny.conf` sends `Host $http_host` (with port) for `/admin`; the hostname comparison accepts either. A proxy that rewrites `Host` to an internal name (for example `lenny_admin:4000`) without sending `X-Forwarded-Host` would make every changing call return 403. Login and logout are not covered by this check.
* **Login fails closed in production.** With `NODE_ENV=production`, if `LENNY_INTERNAL_API_URL` or `ADMIN_INTERNAL_SECRET` is unset or empty, login returns 503. Before, it fell back to the development credentials. This only affects a standalone install of lenny-app that you run with lenny-app's own `compose.yaml` (its `web` service sets neither variable): provide both (for example with `environment:` or an `env_file:`) before upgrading. Installs run through Lenny's own `compose.yaml` already pass both to the admin container (`LENNY_INTERNAL_API_URL` is set there and `ADMIN_INTERNAL_SECRET` comes from `auth.env`), so nothing changes for them.
* **`AUTH_BYPASS=true` is ignored in production.** It only works when `NODE_ENV` is not `production`.
* **Cookies.** `admin_token` is HttpOnly and `SameSite=strict`, and is marked `Secure` when `NODE_ENV=production`, so production must be served over HTTPS (browsers do not store Secure cookies from plain HTTP, except on localhost).
* **Security headers.** All admin responses now send `Content-Security-Policy: frame-ancestors 'none'` (plus `base-uri`, `form-action`, `object-src`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and a restrictive `Permissions-Policy`. The admin can no longer be embedded in an iframe. There is no script CSP yet.
* **Session expiry.** On the App Access screen an expired admin session (401) clears the cookie and returns to the login page.
* **Errors.** Failures that carry no usable message (for example an HTML error page from a proxy) now show a short generic message instead of the raw body.

### Environment variables (names only)

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public Lenny URL for client-side calls (public catalog). Not secret. |
| `LENNY_INTERNAL_API_URL` | Lenny API base for the admin proxy and login, e.g. `http://lenny_api:1337/v1/api`. Server-side only. Required in production. |
| `ADMIN_INTERNAL_SECRET` | Shared secret the proxy sends to Lenny. Server-side only. Required in production. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Development login only, used when the two variables above are unset and `NODE_ENV` is not `production`. |
| `AUTH_BYPASS` | Development only: skips the login check. |

Never put a secret in a `NEXT_PUBLIC_*` variable; those are bundled into the browser.

### Version coupling

App Access needs a Lenny API that provides the `/admin/oauth2/clients` endpoints (list, create, edit, reset secret, enable, disable, remove), that is, the Lenny release that introduced App Access. Against an older Lenny the rest of the admin keeps working and the App Access screen shows "This Lenny server doesn't support App Access yet." The Settings row for App Access then shows no summary. Upgrade Lenny first, then the admin app.
