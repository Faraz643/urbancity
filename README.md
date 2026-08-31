# AdCity - 3D Multiplayer Advertising City

A complete, production-ready 3D multiplayer advertising city built with React Three Fiber, Three.js, Rapier physics, Socket.IO, Node.js, and Prisma.

## Features

- 🏙️ Large explorable 3D city with procedural generation
- 👥 Real-time multiplayer with WebSocket synchronization
- 📺 Physical 3D billboards with live advertisements
- 💰 Complete bidding, auction, and wallet system
- 🔐 JWT authentication with role-based access control
- 📊 Admin dashboard with analytics
- 📱 Mobile touch controls support
- ⚡ Optimized rendering with efficient updates

## Technology Stack

### Frontend
- React 18 + TypeScript
- React Three Fiber + Three.js
- @react-three/drei + @react-three/rapier (physics)
- Zustand (state management)
- Tailwind CSS
- Socket.IO Client
- Vite

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + SQLite
- Socket.IO (WebSocket server)
- JWT Authentication
- bcryptjs (password hashing)
- Helmet + CORS + Rate Limiting

## Quick Start

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration (database URL, JWT secret, etc.)

### 3. Setup Database

```bash
cd backend
npx prisma migrate dev
npm run db:seed
```

### 4. Start Development

From the root directory:

```bash
npm run dev
```

This starts both backend (port 3001) and frontend (port 5173) concurrently.

### 5. Access the Application

- Open http://localhost:5173 in your browser
- Default admin credentials: `admin@adcity.com` / `admin123`
- Default demo credentials: `demo@adcity.com` / `demo123`

## Project Structure

```
ad-city/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Entry point
│   │   ├── routes/                # API routes
│   │   ├── middleware/            # Auth, error handling
│   │   ├── websocket/             # Socket.IO server
│   │   └── utils/                 # Seed data
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── .env.example               # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Main app
│   │   ├── components/
│   │   │   ├── city/              # 3D city components
│   │   │   ├── player/            # Player character
│   │   │   ├── multiplayer/       # Other players
│   │   │   └── ui/                # UI overlays
│   │   ├── stores/                # Zustand stores
│   │   ├── types/                 # TypeScript types
│   │   └── utils/                 # API, socket helpers
│   ├── index.html
│   └── package.json
└── package.json
```

## Core Features

### 3D City
- Procedurally generated modern city with roads, buildings, trees, street furniture
- Bright sunny daytime environment with realistic shadows
- Physics-based collision detection using Rapier
- Third-person camera with smooth follow

### Multiplayer
- Real-time player synchronization via WebSockets
- Interest management (only nearby players receive updates)
- Anonymous visitors automatically spawn with temporary IDs
- Live online visitor count

### Billboard System
- Physical 3D billboards throughout the city
- Two tiers: Premium (main roads) and Street (side streets)
- Live nearby visitor traffic calculation
- Dynamic advertisement display on winning billboards

### Bidding & Auctions
- Real-time bidding system with server-side validation
- Automatic bid increment rules (5% minimum)
- Bid reservation and refund handling
- Outbid notifications
- Auction winner determination

### Wallet & Transactions
- Secure wallet system with transaction history
- Deposit simulation (payment provider integration ready)
- Bid reservations, refunds, and winning payments
- Complete audit trail

### Authentication
- JWT-based secure authentication
- Password hashing with bcrypt
- Role-based access control (User/Admin)
- Anonymous visitor support

### Admin Dashboard
- Complete admin interface at `/admin`
- User management
- Billboard management (create, edit, delete)
- Advertisement moderation (approve/reject)
- Transaction monitoring
- Real-time visitor analytics

## Environment Variables

See `backend/.env.example` for all required variables:

- `DATABASE_URL` - SQLite database path
- `JWT_SECRET` - JWT signing secret
- `PORT` - Backend server port
- `FRONTEND_URL` - CORS allowed origin
- `RATE_LIMIT_*` - Rate limiting configuration

## Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Serve dist/ folder with any static file server
```

## License

MIT
