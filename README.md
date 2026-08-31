# UrbanCity

A playable browser-based 3D advertising city prototype built with **React, React Three Fiber, Three.js, Drei, Rapier, and Socket.IO**.

## Implemented prototype

- Stylized city grid with major roads, intersections, buildings, trees, benches and street lights
- WASD and arrow-key movement
- Rapier capsule player collider
- Fixed colliders for buildings, trees, benches and physical billboards
- Smooth third-person follow camera
- Premium-road and street billboard categories
- Billboard IDs, traffic ratings, bids, availability and demo advertisements
- Nearby billboard interaction and click interaction
- Demo virtual-money bidding
- Socket.IO multiplayer player join/update/leave synchronization
- Remote avatar interpolation
- Online visitor count
- Minimal HUD, controls card and minimap

## Run locally

### 1. Install dependencies

From the repository root:

    npm install
    npm --prefix frontend install
    npm --prefix backend install

### 2. Start the frontend and multiplayer server

    npm run dev

Open the Vite URL, normally http://localhost:5173.
Open the site in a second browser window to test multiplayer.

## Architecture

    urbancity/
    ├── frontend/
    │   ├── src/App.tsx          # R3F city, player, physics, billboards and HUD
    │   └── src/index.css        # UI styling
    ├── backend/
    │   └── src/server.ts        # Express + Socket.IO prototype server
    └── README.md

## Adding GLB road/building assets

Place optimized GLB/GLTF files under:

    frontend/public/assets/

Then load them with Drei useGLTF in modular city components. The current prototype remains playable without external binary assets, using procedural geometry and Rapier colliders.

Recommended future folders:

    frontend/src/components/city/
    frontend/src/components/player/
    frontend/src/components/billboards/
    frontend/src/components/multiplayer/
    frontend/public/assets/roads/
    frontend/public/assets/buildings/
    frontend/public/assets/trees/
    frontend/public/assets/characters/

## Production roadmap

1. Replace procedural prototypes with optimized GLB assets and instancing.
2. Persist users, billboards, advertisements and bids with Prisma/PostgreSQL.
3. Add authentication.
4. Add advertisement uploads and moderation.
5. Replace demo wallet logic with a payment provider.
6. Add server-authoritative validation and scaling for multiplayer.

## Notes

This is a local playable prototype. Demo bids and balances are intentionally not real money and are kept separate from the future payment layer.