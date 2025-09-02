# AI ProjectHub

## Overview

AI ProjectHub is an intelligent project management application that combines traditional project management features with AI-powered capabilities. The application allows teams to manage projects, tasks, and meetings while leveraging AI for voice recording transcription, task extraction, and project insights. Built with a full-stack TypeScript architecture, it features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.
UI terminology preference: Use "Due Date" (capitalized) instead of "deadline date" for project dates.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Shared Zod schemas between frontend and backend
- **API Design**: RESTful API endpoints with centralized error handling
- **Development**: Hot reload with Vite integration for seamless development experience

### Database Design
- **Database**: PostgreSQL with Neon serverless configuration
- **Schema Management**: Drizzle migrations with schema definitions in shared directory
- **Key Entities**: Users, Projects, Tasks, Meetings, Project Members, Notifications, User Settings
- **Relationships**: Proper foreign key constraints and relational design
- **Task Management**: Full CRUD operations with status tracking (todo, in_progress, completed), priority levels (low, medium, high, urgent), and automated priority adjustments

### AI Integration
- **Voice Processing**: AssemblyAI for professional mobile-optimized audio transcription with speaker detection
- **AI Services**: Groq integration for comprehensive project intelligence (preferred over OpenAI)
- **Mobile Optimization**: Specialized constraints and processing for smartphone recordings
- **Smart Features**: 
  - Real-time project health analysis and risk assessment
  - Intelligent deadline monitoring and proactive alerts
  - Daily productivity summaries with actionable recommendations
  - Smart notification system with email integration capabilities
  - Voice recording with automatic task generation
  - Workload balance optimization suggestions
  - Contextual AI recommendations throughout the day
  - **Automated Task Prioritization**: Intelligent task priority adjustment based on due dates, project urgency, and completion status

### Authentication & Session Management
- **Authentication System**: Complete user registration and login with bcrypt password hashing
- **Session Storage**: Express sessions with secure cookie management
- **User Isolation**: Users can only see their own projects and projects they collaborate on
- **Project Collaboration**: Project owners can add collaborators by email
- **Access Control**: Proper authorization checks for project access and management
- **Security Implementation**: All API endpoints require authentication - no content accessible without login
- **Frontend Guards**: Authentication required to view any page except login
- **Voice Recording Support**: Large file upload support for 2-hour voice recordings (50MB limit)
  - Enhanced recording controls with single compact floating button
  - Background recording capability while navigating the app
  - Complete pause/resume functionality with visual feedback
  - Auto-minimizing modal with streamlined workflow
  - Mobile-optimized compact design with all controls in one element
  - **Bulletproof Backup & Recovery System**: Enterprise-grade data protection against all failure scenarios
    - **Automatic Local Backup**: All recordings saved to IndexedDB with real-time verification
    - **Emergency localStorage Backup**: Secondary backup system with compression for critical situations
    - **Heartbeat System**: Recording state saved every 10 seconds during active sessions
    - **Page Visibility API**: Handles screen timeouts and app backgrounding seamlessly
    - **Connection Monitoring**: Auto-retry uploads when network connection returns
    - **Device Failure Protection**: Recordings continue during device sleep, low battery, and interruptions
    - **Accidental Closure Protection**: Warning dialogs prevent data loss from page navigation
    - **Smart Recovery**: Automatic detection and recovery of interrupted recordings on app restart
  - **Smart Retry System**: Failed uploads automatically retry up to 3 times with exponential backoff
  - **Recovery Interface**: Pending recordings can be recovered and processed from Meetings page
  - **Upload Progress**: Real-time progress indicators and detailed error handling

### File Structure
- **Monorepo Design**: Shared schemas and types between client and server
- **Client**: React application with organized components, pages, and hooks
- **Server**: Express API with services, storage layer, and route handlers
- **Shared**: Common TypeScript types and Zod validation schemas

## PWA (Progressive Web App) Implementation

### Core PWA Features
- **Installable**: Full PWA configuration with manifest.json and service worker
- **Offline Capability**: Service worker caches essential resources for offline access
- **Mobile Optimized**: Native app-like experience on iOS and Android devices
- **Install Prompts**: Smart install banners for Chrome/Edge and iOS Safari instructions
- **App Shortcuts**: Quick access to Dashboard, Voice Recording, and Tasks
- **Platform Integration**: Proper icons, splash screens, and theme colors
- **Background Sync**: Foundation for offline actions and push notifications

### PWA Technical Implementation
- **Service Worker**: Comprehensive caching strategy with static and dynamic caches
- **Web App Manifest**: Complete configuration with icons, shortcuts, and display modes
- **Install Component**: React component for cross-platform install prompts
- **Offline Fallbacks**: Graceful handling of network failures with cached responses
- **Mobile Icons**: Generated 192px and 512px app icons with proper metadata
- **Browser Support**: Compatible with Chrome, Edge, Safari, and Firefox

## External Dependencies

### Core AI Services
- **AssemblyAI**: Voice transcription service (API key required)
- **OpenAI/Groq**: AI language models for task extraction and insights
- **Resend**: Email service for notifications and communications

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **WebSocket Support**: For real-time features via Neon's serverless architecture

### Development Tools
- **Replit Integration**: Development environment optimization with cartographer plugin
- **Vite Plugins**: Runtime error overlay and development tooling
- **TypeScript**: Strict type checking across the entire codebase

### UI Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library for consistent iconography
- **Embla Carousel**: Touch-friendly carousel components
- **React Day Picker**: Calendar and date selection components

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Conditional CSS class management
- **nanoid**: Unique ID generation
- **class-variance-authority**: Type-safe component variants

## Critical UI/UX Fixes - DO NOT MODIFY

The following fixes have been implemented and MUST be preserved during all future development. Any changes to these areas require careful verification to prevent regression.

### 🔒 Meeting Time Display Fix
**Location**: `client/src/pages/Meetings.tsx` lines 336-344
**Critical Code**: `formatTime` function with timezone handling
```typescript
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit", 
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // CRITICAL: User's local timezone
  });
};
```
**Purpose**: Displays correct time under "Upcoming Meetings" section using user's local timezone

### 🔒 Blue Meeting Buttons Fix
**Location**: `client/src/pages/Meetings.tsx` - Multiple instances
**Critical Classes**: `bg-blue-600 hover:bg-blue-700` (found on lines 689, 796, 1175)
**Purpose**: All meeting-related buttons are blue instead of red for consistent UI design

### 🔒 Floating Action Buttons Fix
**Location**: `client/src/App.tsx` lines 164-213
**Critical Elements**: 
- Recording button (🎙️): Blue background `#2563eb` at bottom-right (20px from edges)
- AI Assistant button (🤖): Purple background `#8b5cf6` positioned 110px from bottom
**Critical Styles**: 
- `position: 'fixed'`, `zIndex: 999999/999998`
- `width/height: '80px'`, `borderRadius: '50%'`
- Both fully functional with proper click handlers
**Purpose**: Ensures floating buttons are always visible and accessible

### 🔒 Calendar Edit/Delete Buttons Fix
**Location**: `client/src/pages/Calendar.tsx` lines 1791-1830
**Critical Condition**: `event.type === 'meeting' && event.source === 'internal'`
**Critical Code**: Meeting events created internally have `source: 'internal'` (line 627)
**Purpose**: Edit and delete buttons appear in calendar modal for user-created meetings only

### 🛡️ Protection Guidelines for Future Development

1. **Before editing `Meetings.tsx`**: Verify `formatTime` function and blue button classes remain intact
2. **Before editing `App.tsx`**: Ensure floating buttons maintain exact positioning and styling  
3. **Before editing `Calendar.tsx`**: Verify edit/delete button condition and `source: 'internal'` assignment
4. **Testing Protocol**: After any UI changes, verify all four fixes are still working
5. **Search Protocol**: Use code search to locate these critical sections before making changes

### 🔍 Quick Verification Commands
- Search for timezone handling: `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone`
- Search for blue buttons: `bg-blue-600 hover:bg-blue-700`
- Search for floating positioning: `position: 'fixed'.*bottom.*right`
- Search for edit condition: `event.type === 'meeting' && event.source === 'internal'`