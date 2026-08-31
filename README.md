# UrbanCity

A playable browser-based 3D advertising city built with **React, React Three Fiber, Three.js, Rapier, Express, Socket.IO and Prisma**.

## Current implementation

### Game and multiplayer
- Procedural 3D city with roads, buildings, fences, trees and lighting
- Custom low-poly humanoid player
- WASD / arrow-key movement and Rapier physics
- Third-person mouse camera and mouse-wheel zoom
- Evening, morning and night themes
- Physical road billboards and building-wall advertising slots
- Nearby interaction and demo bidding
- Realtime Socket.IO player join/update/leave synchronization
- Remote avatar interpolation and online visitor count
- Live nearby-visitor numbers per advertising location

### Backend foundation
- Express + Socket.IO server
- Prisma + SQLite development database
- JWT authentication and bcrypt password hashing
- Users and wallets
- Persistent billboards and auctions
- Persistent REST bidding endpoint
- Advertisements and advertising campaigns
- Traffic analytics snapshots
- Admin statistics and moderation APIs
- Helmet, CORS, JSON limits, rate limiting and centralized error handling
- Health endpoint with database status

## Local setup

### 1. Install

    npm install
    npm --prefix frontend install
    npm --prefix backend install

### 2. Configure backend

PowerShell:

    cd backend
    Copy-Item .env.example .env

Default development database:

    DATABASE_URL="file:./dev.db"

### 3. Create database

    npm run db:generate
    npm run db:migrate
    npm run db:seed

The seed aligns the database with all 13 advertising locations currently present in the 3D map.

### 4. Start UrbanCity

From the repository root:

    npm run dev

Frontend normally runs at http://localhost:5173.

Backend health endpoint:

    http://localhost:3001/health

## API groups

- `/api/auth` — registration, login, profile
- `/api/billboards` — billboard inventory
- `/api/auctions` — auctions and persistent bids
- `/api/advertisements` — advertisements and campaigns
- `/api/analytics` — traffic analytics
- `/api/admin` — protected administration
- `/api/live/billboards` — current Socket.IO demo bid state

## Architecture

The realtime game remains playable if the database is temporarily unavailable. Multiplayer movement and live demo bidding remain isolated from Prisma, while persistent REST APIs use the database.

This protects the working 3D game while the persistent backend is being integrated.

## Production roadmap

1. Connect frontend billboard inventory directly to database APIs.
2. Add authenticated Socket.IO identities.
3. Make realtime bids create authenticated persistent bid records.
4. Add advertisement image upload/storage and moderation UI.
5. Move from SQLite to PostgreSQL for production.
6. Add server-authoritative multiplayer validation and scaling.
