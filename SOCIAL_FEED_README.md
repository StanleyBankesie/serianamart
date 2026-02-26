# Company Internal Chat + Social Feed System

A production-ready internal communication system for the ERP application with real-time updates, visibility control, and image sharing.

## 🎯 Features

✅ **Post Creation** - Users can create posts with text and images  
✅ **Visibility Control** - Company-wide, warehouse-specific, or selected users  
✅ **Like System** - Toggle likes with duplicate prevention  
✅ **Comments** - Add comments to posts with real-time updates  
✅ **Image Uploads** - Support for JPG, PNG, WebP (max 5MB)  
✅ **Real-time Updates** - Socket.io for instant notifications  
✅ **Notification Integration** - Triggers notifications for post/comment/like events  
✅ **Security** - Backend visibility filtering, auth middleware, input validation  

## 📦 Installation

### 1. Initialize Database Schema

```bash
cd server
node scripts/init_social_feed.js
```

This creates 4 tables:
- `posts` - Post data with visibility settings
- `post_selected_users` - Maps selected user visibility
- `post_likes` - Like tracking with unique constraint
- `post_comments` - Comments on posts

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

Socket.io-client is already added to package.json.

### 3. Restart the Application

The backend now:
- Initializes Socket.io on HTTP server
- Exposes `/api/social-feed` routes
- Broadcasts real-time events to users

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev
```

## 🔌 API Endpoints

All endpoints require authentication via `Authorization: Bearer {token}` header.

### Get Posts with Visibility Filtering

```http
GET /api/social-feed?offset=0&limit=20
```

Returns posts visible to the authenticated user based on:
- Company posts (visible to all)
- Warehouse posts (visible to warehouse members)
- Selected posts (visible to selected users only)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "content": "Post content here",
      "image_url": "https://...",
      "visibility_type": "company",
      "like_count": 12,
      "comment_count": 3,
      "user_liked": true,
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2024-02-13T10:30:00Z",
      "comments": [
        {
          "id": 1,
          "comment_text": "Great post!",
          "user_id": 8,
          "first_name": "Jane",
          "last_name": "Smith",
          "created_at": "2024-02-13T10:35:00Z"
        }
      ]
    }
  ]
}
```

### Create Post

```http
POST /api/social-feed
Content-Type: application/json

{
  "content": "Hello team!",
  "image_url": "https://cloudinary.com/...",
  "visibility_type": "company",
  "selected_user_ids": []
}
```

**Visibility Types:**
- `company` - Visible to all users
- `warehouse` - Visible to users in same warehouse
- `selected` - Visible to specified users only

**Response:** Returns created post object

### Like Post

```http
POST /api/social-feed/{postId}/like
```

Adds a like to a post. Returns 400 if already liked.

### Unlike Post

```http
DELETE /api/social-feed/{postId}/like
```

Removes like from post.

### Add Comment

```http
POST /api/social-feed/{postId}/comments
Content-Type: application/json

{
  "comment_text": "Nice update!"
}
```

Returns comment object with user details.

## 🎨 Frontend Integration

### Basic Usage in Dashboard

Add to your `HomePage.jsx`:

```jsx
import CompanyFeed from "../components/CompanyFeed/CompanyFeed";

export default function HomePage() {
  return (
    <div className="home-page">
      <CompanyFeed />
    </div>
  );
}
```

### Component Structure

```
CompanyFeed
├── PostCreator
│   ├── Post textarea
│   ├── Image upload
│   ├── Visibility selector
│   └── User selection (for selected visibility)
├── PostList
│   └── PostCard (x multiple)
│       ├── Post header (user, time, visibility)
│       ├── Post content (text + image)
│       ├── Like/comment actions
│       └── Comments section
```

### Socket.io Real-time Updates

The `useSocket` hook automatically:
- Connects on component mount
- Joins user/warehouse/company rooms
- Listens for new posts, likes, and comments
- Cleans up on disconnect

```jsx
import { useSocket } from "../hooks/useSocket";

function MyComponent() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("new_post", (post) => {
      // Handle new post
    });

    return () => socket.off("new_post");
  }, [socket]);
}
```

## 🔐 Security

### Backend Visibility Filtering

The server enforces visibility at query level:

```sql
WHERE 
  (p.visibility_type = 'company')
  OR
  (p.visibility_type = 'warehouse' AND p.warehouse_id = ?)
  OR
  (p.visibility_type = 'selected' AND psu.user_id = ?)
```

Users **cannot** access posts they shouldn't see via API.

### Authentication Middleware

All routes require valid JWT token:

```javascript
router.use(authenticate); // Added to all social-feed routes
```

### Input Validation

- Content: Must be non-empty string
- Images: JPG/PNG/WebP only, max 5MB
- Visibility: Enum validation ('company', 'warehouse', 'selected')
- Comments: Required non-empty text

### Unique Constraints

- `post_likes`: Unique (post_id, user_id) - prevents duplicate likes
- `post_selected_users`: Unique (post_id, user_id) - prevents duplicate selections

## 📊 Database Schema

### posts
```
id (PK)
user_id (FK → users.id)
content (LONGTEXT)
image_url (VARCHAR)
visibility_type (ENUM: 'company', 'warehouse', 'selected')
warehouse_id (FK → warehouses.id, nullable)
like_count (INT)
comment_count (INT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### post_selected_users
```
id (PK)
post_id (FK → posts.id)
user_id (FK → users.id)
created_at (TIMESTAMP)
UNIQUE(post_id, user_id)
```

### post_likes
```
id (PK)
post_id (FK → posts.id)
user_id (FK → users.id)
created_at (TIMESTAMP)
UNIQUE(post_id, user_id)
```

### post_comments
```
id (PK)
post_id (FK → posts.id)
user_id (FK → users.id)
comment_text (LONGTEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

## 🔔 Notifications

When a post, comment, or like is created, notifications are:

1. **Inserted into `notifications` table** with type/reference
2. **Broadcast via Socket.io** to relevant users
3. **Displayed in notification badge** on frontend

### Notification Types

- `post_created` - "John posted a new update"
- `post_liked` - "Mary liked your post"
- `post_commented` - "Daniel commented on your post"

## ⚡ Performance Optimization

### Indexes
- `idx_posts_visibility` - Fast visibility filtering
- `idx_posts_warehouse` - Fast warehouse queries
- `idx_posts_created_at` - Fast chronological sorting
- `idx_selected_users_user` - Fast selected user lookups
- `idx_likes_post` - Fast like counting

### Cached Counters
- `posts.like_count` - Updated on like/unlike
- `posts.comment_count` - Updated on comment add

Prevents expensive COUNT(*) queries on every request.

### Socket.io Rooms
- `user_{id}` - Personal messages for user
- `warehouse_{id}` - Warehouse posts
- `company` - Company-wide posts
- `post_{id}` - Comments on specific post

Efficient broadcasting without unnecessary messages.

## 🧪 Testing

### Test Company Post Visibility
```javascript
// User A creates company post
// User B should see it
// User C should see it
```

### Test Warehouse Post Visibility
```javascript
// User A (Warehouse 1) creates warehouse post
// User B (Warehouse 1) should see it
// User C (Warehouse 2) should NOT see it
```

### Test Selected User Visibility
```javascript
// User A creates post, selects User B & User C
// User B should see it
// User C should see it
// User D should NOT see it
```

### Test Duplicate Likes
```javascript
// User A likes post
// Response: 200 OK
// User A likes post again
// Response: 400 "Already liked this post"
```

### Test Real-time Updates
```javascript
// User A creates post
// User B sees instant update (Socket.io event)
// No page refresh required
```

## 🚀 Production Deployment

### Environment Variables

Ensure these are set:
```
NODE_ENV=production
PORT=4002
DATABASE_URL=mysql://...
```

### Database Indexes
All indexes are created during schema initialization.

### Socket.io with Redis (Multi-server)
For load balancing across multiple Node instances:

```bash
npm install socket.io-redis
```

Update `socket.js`:
```javascript
import redisAdapter from "socket.io-redis";
io.adapter(redisAdapter.createAdapter("redis://localhost:6379"));
```

### File Upload Service
Uses existing `/api/upload` endpoint. Ensure:
- Cloudinary or local storage is configured
- File validation is in place
- Size limits are enforced

## 📝 File Structure

```
server/
├── controllers/
│   └── social-feed.controller.js
├── routes/
│   └── social-feed.routes.js
├── utils/
│   └── socket.js
├── scripts/
│   └── init_social_feed.js
└── index.js (updated with Socket.io)

client/
├── src/
│   ├── components/
│   │   └── CompanyFeed/
│   │       ├── CompanyFeed.jsx
│   │       ├── CompanyFeed.css
│   │       ├── PostCreator.jsx
│   │       ├── PostCreator.css
│   │       ├── PostList.jsx
│   │       ├── PostList.css
│   │       ├── PostCard.jsx
│   │       └── PostCard.css
│   └── hooks/
│       └── useSocket.js
└── package.json (updated with socket.io-client)
```

## 🐛 Troubleshooting

### Socket.io not connecting
- Check browser console for errors
- Ensure token is stored in localStorage
- Verify CORS settings in socket.js
- Check server is running on correct port

### Posts not appearing
- Check user warehouse_id matches post warehouse_id
- Verify visibility_type is correct
- Check user is in post_selected_users if visibility='selected'
- Look for SQL errors in server logs

### Likes/comments not updating
- Check Socket.io rooms are joined correctly
- Verify events are being broadcast (check console logs)
- Ensure frontend is listening to correct event names

### Images not uploading
- Check file size < 5MB
- Verify file type is JPG/PNG/WebP
- Check upload endpoint is working (`/api/upload`)
- Look for file validation errors in response

## 📖 Additional Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [MySQL Indexes](https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html)
- [Express Authentication](https://expressjs.com/en/guide/using-middleware.html)
- [React Hooks](https://react.dev/reference/react/hooks)

---

**Happy building!** 🚀
