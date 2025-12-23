# InnoSynth.ai Frontend - Quick Start Guide

## Installation & Setup

### Step 1: Install Dependencies
```bash
cd /Users/michaelkraft/innosynth-ai/frontend
npm install
```

This will install all required packages:
- Next.js 14.2.18
- React 18.3.1
- TypeScript 5.7.2
- Tailwind CSS 3.4.17
- Zustand 5.0.2
- TanStack Query 5.62.11
- Lucide React 0.468.0
- D3.js 7.9.0
- Axios 1.7.9

### Step 2: Configure Environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your backend API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Step 3: Start Development Server
```bash
npm run dev
```

The app will be available at **http://localhost:3000**

## First Run Experience

When you open the app, you'll see:

1. **Hero Section** with the tagline "From Search to Synthesis"
2. **Prominent Search Bar** in the center
3. **Feature Cards** showcasing key capabilities
4. **Stats Section** with metrics

## Testing the Search

1. Click on the search bar
2. Type a query (e.g., "What are our Q1 OKRs?")
3. Press **Enter** or click **Synthesize**
4. You'll see a mock result with:
   - Synthesized answer
   - Confidence score
   - Clickable citations
   - Action buttons (Copy, Save, Share)
   - Feedback options (thumbs up/down)

## Key Features to Explore

### Search Bar
- **Auto-expanding textarea** - grows as you type
- **Keyboard shortcuts**:
  - `Enter` - Submit search
  - `Shift + Enter` - New line
- **Suggested queries** - Click to auto-fill
- **Character counter** - shows as you type

### Search Results
- **Confidence indicator** - High/Medium/Low with color coding
- **Citation badges** - Click to highlight detailed citations
- **Copy functionality** - Copy answer to clipboard
- **User feedback** - Rate results helpful/not helpful

### Navigation
- **Responsive header** - with mobile menu
- **Sidebar** (create dashboard page to see it)
- **Authentication state** - shows login/register or user profile

## Building for Production

```bash
npm run build
npm start
```

## Development Tips

### Adding New Pages
Create files in `app/` directory:
```bash
# Create analytics page
mkdir app/analytics
touch app/analytics/page.tsx
```

### Using Components
```tsx
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchBar from '@/components/search/SearchBar';

function MyComponent() {
  return (
    <Card variant="glass" padding="lg">
      <Button variant="primary">Click Me</Button>
    </Card>
  );
}
```

### API Integration
Replace mock data in `app/page.tsx`:
```tsx
import api from '@/lib/api';

const handleSearch = async (query: string) => {
  try {
    const response = await api.search.query(query);
    setSearchResults(response.data);
  } catch (error) {
    console.error('Search failed:', error);
  }
};
```

### State Management
```tsx
import { useAuthStore } from '@/stores/useAuthStore';

function Component() {
  const { user, login, logout } = useAuthStore();

  const handleLogin = async () => {
    await login(email, password);
  };
}
```

## Styling Guide

### Tailwind Utilities
```tsx
// Glass morphism
<div className="glass rounded-xl p-6">

// Gradient text
<h1 className="gradient-text">Title</h1>

// Hover card effect
<div className="card-hover">

// Custom colors
<div className="bg-background text-primary-400 border-accent-blue">
```

### Custom Animations
```tsx
// Fade in
<div className="animate-fade-in">

// Slide up
<div className="animate-slide-up">

// With delay
<div className="animate-fade-in delay-200">
```

## Troubleshooting

### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
npm run type-check
```

### Port Already in Use
```bash
# Change port in package.json
"dev": "next dev -p 3001"
```

### Tailwind Styles Not Working
```bash
# Rebuild
npm run build
```

## Next Steps

1. **Connect to Backend API** - Replace mock data with real API calls
2. **Add Authentication Pages** - Create login/register flows
3. **Build Dashboard** - Create analytics and management pages
4. **Add More Integrations** - Confluence, Notion, Slack, etc.
5. **Implement Real-time** - WebSocket for live updates
6. **Add Testing** - Jest + React Testing Library

## File Structure Reference

```
frontend/
├── app/
│   ├── layout.tsx          ← Root layout (dark theme)
│   ├── page.tsx            ← Homepage with search
│   └── globals.css         ← Global styles + Tailwind
├── components/
│   ├── ui/
│   │   ├── Button.tsx      ← Reusable button (4 variants)
│   │   ├── Input.tsx       ← Form input with validation
│   │   └── Card.tsx        ← Card + sub-components
│   ├── layout/
│   │   ├── Header.tsx      ← Main navigation
│   │   └── Sidebar.tsx     ← Left sidebar (collapsible)
│   └── search/
│       ├── SearchBar.tsx   ← Main search interface
│       └── SearchResults.tsx ← Results display
├── lib/
│   └── api.ts              ← Axios API client
├── stores/
│   └── useAuthStore.ts     ← Zustand auth store
└── public/                 ← Static assets
```

## Support

For questions or issues, refer to:
- **Main README**: `README.md`
- **API Documentation**: See backend docs
- **Component Examples**: Check `app/page.tsx`

Happy coding! 🚀
