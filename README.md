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
