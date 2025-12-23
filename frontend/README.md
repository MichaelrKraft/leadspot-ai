# InnoSynth.ai Frontend

Enterprise-grade knowledge synthesis platform built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **AI-Powered Search**: Semantic search across 50+ enterprise data sources
- **Knowledge Synthesis**: Instant answers with verifiable citations
- **Dark Mode**: Professional blue tones optimized for enterprise use
- **Responsive Design**: Mobile-first design that works on all devices
- **Type-Safe**: Built with TypeScript in strict mode
- **State Management**: Zustand for authentication and global state
- **API Client**: Axios-based API client with error handling

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios
- **Icons**: Lucide React
- **Data Visualization**: D3.js (ready to use)
- **Data Fetching**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   └── globals.css          # Global styles
├── components/
│   ├── ui/                  # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── layout/              # Layout components
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── search/              # Search-specific components
│       ├── SearchBar.tsx
│       └── SearchResults.tsx
├── lib/
│   └── api.ts              # API client
├── stores/
│   └── useAuthStore.ts     # Authentication store
├── public/                 # Static assets
└── tailwind.config.ts      # Tailwind configuration
```

## Key Components

### SearchBar
Prominent, centered search interface with:
- Auto-expanding textarea
- Keyboard shortcuts (Enter to search, Shift+Enter for new line)
- Loading states
- Suggested queries

### SearchResults
Displays synthesized answers with:
- Confidence indicators
- Clickable citations
- Copy, save, and share functionality
- User feedback (thumbs up/down)
- Detailed citation cards

### Header
Main navigation with:
- Logo and branding
- Desktop/mobile navigation
- Authentication state
- Responsive menu

### UI Components
- **Button**: Multiple variants (primary, secondary, outline, ghost)
- **Input**: Form inputs with labels, errors, and icons
- **Card**: Flexible card component with sub-components

## Design System

### Colors
- **Background**: `#0A0F1C` (main), `#121827` (secondary)
- **Primary Blue**: `#0066E6` with shades from 50-900
- **Accent Blue**: `#1E3A5F`
- **Semantic Colors**: Success, Warning, Error, Info

### Typography
- **Font**: Inter (sans-serif), JetBrains Mono (monospace)
- **Headings**: Responsive sizing (text-4xl to text-7xl)
- **Body**: text-lg for main content

### Effects
- **Glass Morphism**: `glass` utility class
- **Glow Effects**: `shadow-glow` and `shadow-glow-lg`
- **Animations**: Fade-in, slide-up, gradient shifts

## API Integration

The frontend communicates with the backend via the API client in `lib/api.ts`:

```typescript
import api from '@/lib/api';

// Search
const results = await api.search.query("What are our Q1 OKRs?");

// Authentication
await api.auth.login(email, password);

// Knowledge base
const documents = await api.knowledge.getDocuments();
```

## State Management

Authentication state is managed via Zustand:

```typescript
import { useAuthStore } from '@/stores/useAuthStore';

function Component() {
  const { user, isAuthenticated, login, logout } = useAuthStore();

  // Use state...
}
```

## Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel
```

### Docker
```dockerfile
# Dockerfile included in project root
docker build -t innosynth-frontend .
docker run -p 3000:3000 innosynth-frontend
```

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL for real-time features
- `NEXT_PUBLIC_APP_NAME`: Application name
- `NEXT_PUBLIC_APP_VERSION`: Application version

## Contributing

1. Follow TypeScript strict mode rules
2. Use existing component patterns
3. Maintain mobile-first responsive design
4. Add proper error handling
5. Include loading states for async operations

## License

Proprietary - InnoSynth.ai
