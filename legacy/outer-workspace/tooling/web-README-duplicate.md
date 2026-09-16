# g000st - Next.js Unified Dashboard

A professional unified dashboard combining user and admin interfaces built with Next.js 15, TypeScript, Tailwind CSS, and Axios.

## 📁 Project Structure

```
g000st-web/
├── app/
│   ├── (auth)/              # Authentication routes
│   │   ├── login/           # Login page
│   │   └── register/        # Registration page
│   ├── (user)/              # User dashboard
│   │   ├── layout.tsx       # User dashboard frame
│   │   ├── chat/            # Messaging interface
│   │   ├── social/          # Social feed
│   │   ├── contacts/        # Contact management
│   │   └── profile/         # User profile
│   ├── (admin)/             # Admin dashboard
│   │   ├── layout.tsx       # Admin dashboard frame
│   │   ├── dashboard/       # System overview
│   │   ├── users/           # User management table
│   │   └── settings/        # App configuration
│   ├── api/                 # API layer
│   │   ├── axios.ts         # Axios instance with interceptors
│   │   ├── auth.ts          # Auth endpoints
│   │   ├── chat.ts          # Chat endpoints
│   │   ├── social.ts        # Social endpoints
│   │   └── users.ts         # User/admin endpoints
│   ├── layout.tsx           # Root layout
│   ├── globals.css          # Tailwind + global styles
│   └── page.tsx             # Home/landing page
├── components/
│   └── ui/
│       └── Modal.tsx        # Modal component
├── context/                 # React contexts
│   ├── ModalContext.tsx     # Global modal state
│   └── ConfirmModalContext.tsx  # Confirm dialog state
├── hooks/                   # Custom hooks
│   └── index.ts            # useAuth, useLocalStorage, useAsync, useDebounce
├── types/                   # TypeScript definitions
│   └── index.ts
├── middleware.ts            # Next.js middleware (auth protection)
├── .env.local              # Environment variables (Firebase, API)
├── .env.example            # Example environment template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── tailwind.config.ts      # Tailwind CSS config
├── postcss.config.js       # PostCSS config
└── next.config.js          # Next.js config
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (includes npm)
- Git

### Installation

1. **Navigate to project**
   ```bash
   cd /Users/moudy/Desktop/g000st-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Firebase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 🔐 Authentication

### Features
- ✅ Email/password login and registration
- ✅ localStorage token persistence
- ✅ Automatic token injection in requests
- ✅ Auto-redirect on 401/403
- ✅ Route protection via middleware
- ✅ Admin role-based access control

### How It Works
1. User logs in via `/login`
2. Backend returns `auth_token` and `user_id`
3. Tokens stored in localStorage
4. Axios intercepts requests and adds `Authorization: Bearer {token}`
5. On 401/403 response, user redirected to `/login`
6. Middleware prevents unauthorized route access

### Default Test Credentials
| Email | Password | Role |
|-------|----------|------|
| user@test.com | password123 | user |
| admin@test.com | admin123 | admin |

## 🗂️ Page Routes

### Public Routes
- `/` - Home/landing page
- `/login` - User login form
- `/register` - User registration form

### User Routes (protected)
- `/chat` - Messaging interface with realtime chat
- `/social` - Social feed with posts, likes, comments
- `/contacts` - Contact list with chat area selection
- `/profile` - User profile editor with settings

### Admin Routes (protected + admin only)
- `/admin/dashboard` - System overview & statistics
- `/admin/users` - User management table with search
- `/admin/settings` - App configuration & feature toggles

## 📦 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4
- **HTTP Client**: Axios 1.7
- **Icons**: Lucide React 0.427
- **Notifications**: React Hot Toast 2.4.1
- **Backend**: Firebase Realtime Database

## 🔌 API Layer

Centralized API management with automatic error handling and interceptors.

### Request Interceptor
```typescript
// Automatically adds Authorization header
Authorization: Bearer {token_from_localStorage}
```

### Response Interceptor
```typescript
// Auto-handles 401/403 errors
- Removes auth token
- Redirects to /login
- Shows error toast
```

### API Endpoints

#### Auth (`/app/api/auth.ts`)
```typescript
import { authAPI } from "@/app/api/auth";

await authAPI.login(email, password);
await authAPI.register(name, email, password);
await authAPI.logout();
await authAPI.getCurrentUser();
```

#### Chat (`/app/api/chat.ts`)
```typescript
import { chatAPI } from "@/app/api/chat";

await chatAPI.getConversations();
await chatAPI.getMessages(conversationId);
await chatAPI.sendMessage(conversationId, content);
await chatAPI.startConversation(userId);
```

#### Social (`/app/api/social.ts`)
```typescript
import { socialAPI } from "@/app/api/social";

await socialAPI.getPosts();
await socialAPI.createPost(content, media);
await socialAPI.toggleLike(postId);
await socialAPI.addComment(postId, content);
```

#### Users (`/app/api/users.ts`)
```typescript
import { usersAPI } from "@/app/api/users";

// User endpoints
await usersAPI.updateProfile(data);
await usersAPI.changePassword(oldPwd, newPwd);

// Admin endpoints
await usersAPI.getAllUsers(page);
await usersAPI.suspendUser(userId);
await usersAPI.deleteUser(userId);
```

## 🎨 Global Components

### Modal System

#### 1. Generic Modal
```typescript
import { useModal } from "@/context/ModalContext";

const { openModal, closeModal } = useModal();

openModal({
  title: "Confirm Action",
  message: "Do you want to proceed?",
  type: "warning",           // info | success | error | warning
  primaryButton: { 
    label: "Yes", 
    onClick: () => handleYes() 
  },
  secondaryButton: { 
    label: "Cancel" 
  }
});
```

#### 2. Confirm Modal (Promise-based)
```typescript
import { useConfirmModal } from "@/context/ConfirmModalContext";

const { confirm } = useConfirmModal();

const result = await confirm({
  title: "Delete User?",
  message: "This action cannot be undone.",
  isDangerous: true           // Red button for dangerous actions
});

if (result) {
  // User confirmed
}
```

## 🪝 Custom Hooks

### useAuth()
Manage authentication state:
```typescript
const { token, userId, isAuthenticated, logout } = useAuth();
```

### useLocalStorage()
Safe localStorage management with SSR support:
```typescript
const [value, setValue] = useLocalStorage("key", defaultValue);

setValue(newValue);           // Updates state + localStorage
setValue(prev => prev + 1);   // Functional updates
```

### useAsync()
Handle async operations with loading/error states:
```typescript
const { data, loading, error, execute } = useAsync(fetchFn);

// Manual execution
await execute();

// Immediate execution (default)
```

### useDebounce()
Debounce values for efficient searches:
```typescript
const [searchTerm, setSearchTerm] = useState("");
const debouncedTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedTerm) {
    // Perform search
  }
}, [debouncedTerm]);
```

## 🛡️ Middleware & Route Protection

The `middleware.ts` file handles:
- ✅ Authentication checks on protected routes
- ✅ Admin role verification
- ✅ Automatic redirects for unauthorized access
- ✅ SSR-safe implementation

**Protected Routes** - Require `auth_token`:
- All `/chat`, `/social`, `/contacts`, `/profile` routes
- All `/admin/*` routes

**Admin Routes** - Require `user_role === 'admin'`:
- `/admin/dashboard`
- `/admin/users`
- `/admin/settings`

## 📊 Page Features

### Login Page
- Email/password input fields
- Form validation
- Firebase authentication
- localStorage token storage
- Error toast notifications
- Auto-redirect to `/chat` on success

### Register Page
- Name, email, password inputs
- Password confirmation matching
- 8+ character password validation
- Email uniqueness check
- Inline error display
- Success redirect to login

### Chat Page
- Realtime message display
- Message timestamps
- Send message with Enter key
- User/other message differentiation
- Call/video call buttons
- Contact header with status

### Social Page
- Post composer with character counter
- Feed display with posts
- Like button with animation
- Comment counter
- Share button
- Author info with timestamp
- Mock data for demo

### Contacts Page
- Searchable contact list
- Status indicators (online/away/offline)
- Unread badge count
- Last message preview
- Quick call/video buttons
- Dual-pane layout (list + chat area)

### Profile Page
- User avatar display
- Edit mode toggle
- Editable fields: name, bio, email, phone, country
- Interest tags display
- Account settings: password, privacy, notifications
- Delete account option
- Save/cancel workflow

### Admin Dashboard
- 4 statistics cards
  - Total Users
  - Active Chats
  - Growth Percentage
  - System Status
- Recent activity timeline
- Color-coded metrics
- Responsive grid layout

### Users Management
- User table with search
- Columns: name, email, status, joined date, posts, last active
- Bulk selection support
- Suspend/unsuspend toggle
- Delete user with confirmation
- Status badges (active/suspended)

### Settings
- App name configuration
- Brand color picker
- Max upload file size
- Feature toggles:
  - Enable Chat
  - Enable Social Feed
  - Allow New Registrations
  - Maintenance Mode
- Contact & Legal:
  - Support email
  - Privacy Policy URL
  - Terms of Service URL
- Save settings button

## 🎯 TypeScript Definitions

Key types defined in `/types/index.ts`:

```typescript
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "moderator";
}

interface Post {
  id: string;
  authorId: string;
  content: string;
  likes: string[];
  comments: Comment[];
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  status: "online" | "away" | "offline";
  unreadCount: number;
}
```

## 🧹 Code Quality

- ✅ TypeScript strict mode
- ✅ ESLint configured
- ✅ Consistent component patterns
- ✅ Error boundary ready
- ✅ Accessibility patterns in place

## 🐛 Troubleshooting

### "localStorage is not defined"
Use `useLocalStorage` hook or wrap in `typeof window !== 'undefined'` check

### Token not sent to API
Verify:
- Token exists in localStorage key `auth_token`
- Axios interceptor in `/app/api/axios.ts` is checking localStorage
- Backend expects `Authorization: Bearer {token}` header

### Routes not protected
Check:
- `middleware.ts` exists in project root
- `.env.local` has necessary Firebase config
- Browser cookies not blocking JWT

### Styling not loading
```bash
npm run dev  # Rebuild Tailwind cache
# Clear:
rm -rf .next node_modules
npm install
npm run dev
```

### API requests failing
1. Verify backend is running
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Review CORS settings on backend
4. Check browser console for detailed errors

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```
Automatically detects Next.js and configures deployment.

### Manual Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
```

### Build for Production
```bash
npm run build    # Creates optimized build
npm start        # Runs production server
```

## 📞 Support & Issues

For questions or issues:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review API endpoint responses in browser DevTools
3. Check backend server logs
4. Verify .env.local configuration

## 📄 License

Property of g000st. Unauthorized copying prohibited.

## 🎉 Project Status

- ✅ Complete: All routes, pages, API layer
- ✅ Complete: Auth system with token management
- ✅ Complete: Global modal components
- ✅ Complete: Custom hooks (useAuth, useStorage, etc)
- ✅ Complete: TypeScript type definitions
- ✅ Complete: Middleware for route protection
- ✅ Ready: Production deployment

---

**Version**: 1.0.0  
**Created**: 2024  
**Last Updated**: 2024  
**Status**: ✅ Production Ready
