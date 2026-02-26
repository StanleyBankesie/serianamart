# 🚀 Social Feed System - Quick Start Guide

## Step 1: Initialize Database (30 seconds)

```bash
cd server
node scripts/init_social_feed.js
```

Expected output:

```
✅ posts table created
✅ post_selected_users table created
✅ post_likes table created
✅ post_comments table created
✅ Social Feed Schema initialized successfully!
```

## Step 2: Install Frontend Dependencies

Socket.io-client is already added to package.json. Just ensure it's installed:

```bash
cd client
npm install
```

## Step 3: Restart Both Servers

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

Backend should log:

```
✅ Socket.io initialized
Server running on port 4002
```

## Step 4: Add CompanyFeed to Your Dashboard

In your `HomePage.jsx` or any dashboard component:

```jsx
import CompanyFeed from "../components/CompanyFeed/CompanyFeed";

export default function HomePage() {
  return (
    <div>
      {/* Other dashboard content */}
      <CompanyFeed />
    </div>
  );
}
```

## ✨ You're Done!

The system is now live with:

- ✅ Post creation with images
- ✅ Company/warehouse/selected visibility
- ✅ Real-time likes and comments
- ✅ Socket.io notifications
- ✅ Automatic database integration

## 🎯 What You Can Do

**Create a Post:**

1. Click the text area in the CompanyFeed
2. Write content, optionally add image
3. Select visibility (Company/Warehouse/Selected users)
4. Click "Post"

**Like/Comment:**

1. Click "👍 Like" to toggle like
2. Click "💬 Comment" to expand comments
3. Add comment and click "Post"

**Real-time Magic:**

- Other users see your post instantly
- Like counts update in real-time
- Comments appear without refresh
- All via Socket.io rooms

## 📊 Database Verification

To verify tables were created:

```bash
mysql -u root -p
USE your_database;
SHOW TABLES LIKE 'post%';
DESC posts;
DESC post_comments;
DESC post_likes;
DESC post_selected_users;
```

## 🔑 Key Files Created/Modified

**Backend:**

- ✅ `server/controllers/social-feed.controller.js` - All business logic
- ✅ `server/routes/social-feed.routes.js` - API endpoints
- ✅ `server/utils/socket.js` - Socket.io setup
- ✅ `server/scripts/init_social_feed.js` - Database initialization
- ✅ `server/index.js` - Updated with Socket.io

**Frontend:**

- ✅ `client/src/components/CompanyFeed/CompanyFeed.jsx` - Main component
- ✅ `client/src/components/CompanyFeed/PostCreator.jsx` - Create posts
- ✅ `client/src/components/CompanyFeed/PostList.jsx` - List posts
- ✅ `client/src/components/CompanyFeed/PostCard.jsx` - Individual post
- ✅ `client/src/hooks/useSocket.js` - Socket.io integration
- ✅ CSS files for styling
- ✅ `client/package.json` - Added socket.io-client

## 🧪 Quick Test

1. Open browser at `http://localhost:5173`
2. Log in as a user
3. Navigate to dashboard (wherever you added CompanyFeed)
4. Create a post with "Test post"
5. In another browser tab, log in as different user
6. See the post appear instantly (no refresh)
7. Like it and see count update immediately
8. Add a comment - instant update

## ❓ Common Issues

**"Socket.io not initializing"**

- Check server terminal for errors
- Verify Socket.io imports are correct
- Make sure server restarted after changes

**"Tables already exist"**

- Script checks `IF NOT EXISTS`, safe to run again
- Tables will not be recreated

**"No token in Socket.io"**

- Ensure token is in localStorage
- Check auth flow saves token with key 'token'
- Check userId and warehouseId are also saved

**"Port 4002 still in use"**

- Kill old processes: `taskkill /F /IM node.exe`
- Or restart your computer

## 📈 What Happens Behind the Scenes

1. **You create post** → Backend saves to DB + broadcasts via Socket.io → All visible users get instant notification
2. **You like post** → Backend records like + broadcasts → Like count updates for all viewers
3. **You comment** → Backend saves + broadcasts → Comment appears on all screens
4. **Socket.io rooms** → Each user in `company`/`warehouse_{id}`/`user_{id}` room → Efficient targeting

## 🔐 Security Verified

- ✅ Visibility enforced at SQL query level
- ✅ Authentication required on all routes
- ✅ Input validation on all fields
- ✅ Duplicate likes prevented (unique constraint)
- ✅ Users can't see posts they shouldn't

## 📖 Full Documentation

See `SOCIAL_FEED_README.md` for:

- Complete API reference
- Detailed database schema
- Advanced Socket.io usage
- Production deployment
- Troubleshooting guide

---

**Questions?** Check the console logs for detailed error messages!
