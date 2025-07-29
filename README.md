# Lenny-app

This Lenny-app is maintained by the ArchiveLabs. which is client app example for [Lenny](https://lennyforlibraries.org)

## Technologies
* [`Turborepo`](https://turborepo.com/) for deployment. 
* [`Nextjs`](https://nextjs.org) inside Turborepo.
* [`Tailwindcss`](https://tailwindcss.com) for styling.
* [`docker`](https://www.docker.com/) for deployment and containerization (Coming soon).
  
## Development Setup 

1. Start your Development enviroment by running the below command, for more check [Lenny-app Wiki](https://github.com/ArchiveLabs/lenny-app/wiki/Setup)
   
   ```bash
   pnpm run dev
   ```
2. Make sure you have your own Lenny setup running on your machine [Link](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation)
   
   ```bash
   git clone git@github.com:ArchiveLabs/lenny.git
   cd lenny
   ./run.sh --public --preload  
   ```
   This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.

## Development Setup 

1. Start your Production enviroment by running the below command, for more check [Lenny-app Wiki](https://github.com/ArchiveLabs/lenny-app/wiki/Setup)
   
   ```bash
   pnpm run build
   ```
2. Make sure you have your own Lenny setup running on your machine [Link](https://github.com/ArchiveLabs/lenny?tab=readme-ov-file#installation)
   
   ```bash
  curl -fsSL https://raw.githubusercontent.com/ArchiveLabs/lenny/refs/heads/main/install.sh | sudo sh
   ```
   This will add 800+ books inside your [Lenny](https://github.com/ArchiveLabs/lenny). Feel free to check the Github Docs for Lenny.


## Pilot

We're seeking partnerships with libraries who would like to try lending digital resources to their patrons. 