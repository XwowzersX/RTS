# Iron & Stone - Real-Time Strategy Game

## Overview

Iron & Stone is a multiplayer real-time strategy (RTS) game built with a React frontend and Express backend. Players create or join game sessions, manage resources (wood, stone, iron, ladders), construct buildings, and train units to compete against opponents. The game uses WebSocket connections for real-time state synchronization and HTML5 Canvas for rendering the game world.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing (Lobby and Game pages)
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme (moody RTS aesthetic with Cinzel and Rajdhani fonts)
- **Game Rendering**: HTML5 Canvas API for performance-critical game visualization
- **Real-time Communication**: Native WebSocket API connecting to `/ws` endpoint

### Backend Architecture
- **Framework**: Express 5 running on Node.js with TypeScript
- **HTTP Server**: Node's native `http.createServer` wrapping Express
- **WebSocket**: `ws` library for real-time game state broadcasting
- **Game Logic**: Server-authoritative game loop with configurable tick rate (10 updates/second)
- **Session Storage**: In-memory game storage using `MemStorage` class with Map-based game instances
- **API Design**: REST endpoints for game creation/joining, WebSocket for real-time gameplay

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains both database tables and game type definitions
- **Migrations**: Drizzle Kit configured for PostgreSQL migrations in `./migrations` folder
- **Game State**: Stored in-memory per active game session (not persisted to database)

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: esbuild bundles server code, Vite builds client to `dist/public`
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared types

### Key Design Patterns
- **Shared Types**: Game constants, entity types, and costs defined in `shared/schema.ts` for client-server consistency
- **Route Contracts**: API endpoints and WebSocket message schemas defined in `shared/routes.ts` using Zod
- **Component-based UI**: Reusable UI components in `client/src/components/ui/`
- **Custom Hooks**: Game-specific logic extracted into hooks (`use-game-socket`, `use-game-controls`)

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management
- **connect-pg-simple**: PostgreSQL session store capability (available but game sessions are in-memory)

### Frontend Libraries
- **Radix UI**: Accessible primitive components for dialogs, tooltips, dropdowns, etc.
- **TanStack React Query**: Async state management for API calls
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant styling
- **embla-carousel-react**: Carousel component
- **react-day-picker**: Date picker component
- **Recharts**: Chart components (via shadcn/ui)

### Backend Libraries
- **ws**: WebSocket server implementation
- **Zod**: Schema validation for API inputs and WebSocket messages
- **nanoid**: Unique ID generation

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)