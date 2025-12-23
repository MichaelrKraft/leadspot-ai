# Decision Archaeology Timeline Visualization

## Overview

The Decision Archaeology feature is the killer differentiator for InnoSynth.ai - a powerful D3.js-based timeline visualization that reconstructs the complete history of enterprise decisions by connecting documents, Slack messages, emails, and decision points.

## Components

### 1. **DecisionTimeline.tsx** - Main Timeline Component
The core visualization component that orchestrates the entire timeline experience.

**Features:**
- D3.js-powered horizontal timeline with zoom and pan
- Interactive event nodes with hover tooltips
- Connection lines showing relationships between events
- Responsive design with auto-resize handling
- Filter by event type
- Export to SVG

**Props:**
```typescript
interface DecisionTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}
```

### 2. **TimelineNode.tsx** - Individual Event Node
Represents a single event on the timeline with interactive features.

**Features:**
- Color-coded by event type (Document: Blue, Slack: Purple, Email: Green, Decision: Gold)
- Animated hover effects
- Tooltip preview on hover
- Click to expand full details
- Selected state with glow effect

### 3. **TimelineEventCard.tsx** - Expanded Event Details
Modal component showing comprehensive event information.

**Features:**
- Full event content display
- Author and timestamp
- Event metadata (channel, recipients, tags)
- Related events navigation
- Source URL link
- Dark theme UI with colored borders

### 4. **DecisionFactors.tsx** - Factor Visualization
D3.js pie chart showing the weighted factors that influenced a decision.

**Features:**
- Animated pie chart with smooth transitions
- Hover effects for individual factors
- Legend with factor descriptions
- Percentage calculations
- Color-coded segments

### 5. **TimelineControls.tsx** - Interactive Controls
Control panel for timeline manipulation and filtering.

**Features:**
- Zoom in/out buttons
- Fit to screen
- Event type filters
- Export to SVG
- Collapsible filter panel

## Usage

### Basic Implementation

```tsx
import { DecisionTimeline } from '@/components/timeline/DecisionTimeline';
import { generateMockTimelineData } from '@/hooks/useTimeline';

function MyPage() {
  const data = generateMockTimelineData('decision-id');

  return (
    <DecisionTimeline
      events={data.events}
      onEventClick={(event) => console.log('Clicked:', event)}
    />
  );
}
```

### With Decision Factors

```tsx
import { DecisionFactors } from '@/components/timeline/DecisionFactors';

function DecisionPage() {
  const factors = [
    {
      id: '1',
      name: 'Market Demand',
      weight: 35,
      description: 'Customer validation',
      supportingEvents: ['evt-1']
    },
    // ...more factors
  ];

  return (
    <DecisionFactors
      factors={factors}
      width={400}
      height={400}
    />
  );
}
```

## Data Structure

### TimelineEvent
```typescript
interface TimelineEvent {
  id: string;
  type: 'document' | 'slack' | 'email' | 'decision';
  title: string;
  timestamp: Date;
  author: string;
  content: string;
  sourceUrl?: string;
  metadata?: {
    channel?: string;
    recipients?: string[];
    tags?: string[];
  };
  relatedEvents?: string[];
}
```

### DecisionData
```typescript
interface DecisionData {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  decision: string;
  factors: DecisionFactor[];
  outcome?: string;
  participants: string[];
}
```

## Styling

All components follow InnoSynth.ai's dark theme design system:

**Colors:**
- Background: `#0A0F1C`
- Card Background: `#1F2937`
- Border: `#374151`
- Document Events: `#3B82F6` (Blue)
- Slack Events: `#8B5CF6` (Purple)
- Email Events: `#10B981` (Green)
- Decision Events: `#F59E0B` (Gold)

**Typography:**
- Primary Text: `#FFFFFF`
- Secondary Text: `#9CA3AF`
- Muted Text: `#6B7280`

## D3.js Integration

The timeline uses D3.js v7 for:
- Time scale creation
- Node position calculation
- Zoom and pan behavior
- SVG rendering
- Animations and transitions
- Pie chart generation

**Key D3 Features:**
```typescript
// Time scale for x-axis positioning
const timeScale = d3.scaleTime()
  .domain([startDate, endDate])
  .range([leftMargin, rightMargin]);

// Zoom behavior
const zoom = d3.zoom()
  .scaleExtent([0.5, 3])
  .on('zoom', handleZoom);

// Pie chart for factors
const pie = d3.pie()
  .value(d => d.weight);
```

## Responsive Design

Components adapt to different screen sizes:

**Desktop (≥1024px):**
- Full timeline with side-by-side factor visualization
- 1200px default width
- 600px height

**Tablet (768px - 1023px):**
- Stacked layout with factors above timeline
- Reduced margins
- Touch-friendly controls

**Mobile (<768px):**
- Horizontal scroll enabled
- Compact controls
- Simplified tooltips

## Performance Optimization

**Best Practices:**
1. Use `React.memo` for event nodes to prevent unnecessary re-renders
2. Debounce zoom/pan events
3. Virtualize large event lists (>100 events)
4. Lazy load event details
5. Optimize SVG rendering with `will-change` CSS

**Example:**
```typescript
const MemoizedTimelineNode = React.memo(TimelineNode);
```

## API Integration

### Fetch Timeline Data
```typescript
// Using the useTimeline hook
import { useTimeline } from '@/hooks/useTimeline';

function MyComponent() {
  const { data, loading, error, refetch } = useTimeline('decision-id');

  if (loading) return <Loader />;
  if (error) return <Error />;

  return <DecisionTimeline events={data.events} />;
}
```

### API Endpoint
```
GET /api/decisions/{decisionId}/timeline

Response:
{
  "events": TimelineEvent[],
  "decision": DecisionData,
  "timeRange": {
    "start": Date,
    "end": Date
  }
}
```

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- Keyboard navigation support
- ARIA labels for screen readers
- Focus indicators
- Color contrast ratios ≥4.5:1
- Alt text for visual elements

**Keyboard Shortcuts:**
- `+` / `-`: Zoom in/out
- `0`: Fit to screen
- `Arrow Keys`: Pan timeline
- `Enter`: Select focused event
- `Esc`: Close event card

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

1. **Real-time Collaboration**: Live cursors for team viewing
2. **AI Insights**: Automated pattern detection in decision timelines
3. **Export Formats**: PDF, PNG, interactive HTML
4. **Custom Views**: Different layout algorithms (vertical, radial)
5. **Animations**: Playback mode showing decision evolution over time
6. **Search**: Full-text search across all events
7. **Bookmarks**: Save interesting timeline positions

## Troubleshooting

**Timeline not rendering:**
- Check that D3.js is installed: `npm list d3`
- Verify events have valid timestamps
- Ensure SVG container has dimensions

**Poor performance with many events:**
- Enable virtualization for >100 events
- Reduce animation duration
- Use `React.memo` on child components

**Zoom not working:**
- Check browser console for D3 zoom errors
- Verify SVG dimensions are set
- Ensure zoom behavior is attached after mount

## Contributing

When adding new features:
1. Follow existing TypeScript patterns
2. Add proper type definitions
3. Include accessibility features
4. Write responsive CSS
5. Test across browsers
6. Document new props/features

## License

Proprietary - InnoSynth.ai
