# Lenny-app

This Lenny-app is maintained by the ArchiveLabs. which is client app example for [Lenny](https://lennyforlibraries.org)

## Technologies
* [`Turborepo`](https://turborepo.com/) for deployment. 
* [`Nextjs`](https://nextjs.org) inside Turborepo.
* [`Tailwindcss`](https://tailwindcss.com) for styling.
* [`docker`](https://www.docker.com/) for deployment and containerization (Coming soon).
  
## Endpoints

Without Docker (dev)

* Web: [http://localhost:3000/](http://localhost:3000/)
* Docs: [http://localhost:3001/](http://localhost:3001/)

With Docker (via Nginx reverse proxy)

* Web: [http://localhost:8080/](http://localhost:8080/)
* Docs: [http://localhost:8081/](http://localhost:8081/)

Notes

* Each app runs its own Nginx inside the container on port 80 and proxies to the Next.js server on 127.0.0.1:3000.
* The docker compose file maps host ports 8080 (web) and 8081 (docs) to container port 80.
* To serve web on plain [http://localhost/](http://localhost/), change the web service ports mapping to `80:80` in `docker-compose.yml`.

## Nginx (in short)

* Location: `docker/nginx.conf` (shared by both app containers).
* Purpose: simple reverse proxy to Next.js on 127.0.0.1:3000 with standard headers and upgrade support.
* No path prefixes; each app is served at `/` in its own container.
* A debug response header `X-Proxy` is added to show which Nginx responded; remove the `add_header X-Proxy ...` line if you don’t need it.

## Development Setup

1. Start your Development enviroment by running the below command, for more check [Lenny-app Wiki](https://github.com/ArchiveLabs/lenny-app/wiki/Setup)
   
   ```bash
   pnpm run dev
   ```

   
2. Make sure you have your own Lenny setup running on your machine ([installation guide](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation))

   ```bash
   git clone git@github.com:ArchiveLabs/lenny.git
   cd lenny
   ./run.sh --public --preload  
   ```
   
   This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.

## Production Setup

1. Start your Production enviroment by running the below command, for more check [Lenny-app Wiki](https://github.com/ArchiveLabs/lenny-app/wiki/Setup)
   
   ```bash
   pnpm run build
   ```

   
2. Make sure you have your own Lenny setup running on your machine ([installation guide](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation))

   ```bash
   curl -fsSL https://raw.githubusercontent.com/ArchiveLabs/lenny/refs/heads/main/install.sh | sudo sh
   ```
   
   This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.


## Pilot

We're seeking partnerships with libraries who would like to try lending digital resources to their patrons.
