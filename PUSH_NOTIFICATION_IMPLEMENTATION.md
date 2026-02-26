# Push Notification Integration for Social Feed

## Overview

This document details the complete implementation of push notifications for the social feed system, including unread activity badge, notification modal, and dedicated post page navigation.

## Implementation Details

### 1. Backend Push Notification Integration

#### Files Modified:

- **`server/controllers/social-feed.controller.js`**

#### Changes:

1. **Added Import**: Imported `sendPushToUser` from push routes

   ```javascript
   import { sendPushToUser } from "./../../routes/push.routes.js";
   ```

2. **Updated `triggerPostNotifications()` Function**
   - Now sends push notifications to all target users when a post is created
   - Includes post title, content preview, and navigation URL
   - Push payload includes:
     - `title`: "New post from {userName}"
     - `body`: "{userName} posted a new update"
     - `data.url`: `/social-feed/{postId}`
     - `data.type`: "post"
     - `data.postId`: Numeric post ID

3. **Updated `triggerLikeNotification()` Function**
   - Sends push notification to post owner when post is liked
   - Includes notification with liker's name
   - Direct navigation to post via push click

4. **Updated `triggerCommentNotification()` Function**
   - Sends push notification to post owner when comment is added
   - Includes commenter's name and context

### 2. Frontend Push Notification Display

#### Files Modified:

- **`client/src/components/CompanyFeed/CompanyFeed.jsx`**

#### Changes:

1. **Badge Positioning Improvement**
   - Moved badge to float at top-right corner of PostCreator card
   - Uses `transform` utilities for precise positioning: `transform -translate-y-2 translate-x-2`
   - Badge appears outside the card boundary for better visibility
   - Added pulsing animation to draw attention

2. **Unread Activity Modal**
   - Shows list of all unread posts and comments
   - Displays count of unread items in header
   - Shows each item with user name, preview text, and type label
   - Modal is fixed-position, overlay blocks interaction with rest of page

3. **Navigation Update**
   - Changed from query parameter `/social-feed?post={id}` to route parameter `/social-feed/{id}`
   - Clicking unread item navigates to dedicated post page showing only that post
   - Unread items are removed from badge after clicking

4. **Socket.io Integration**
   - Listens for `new_post`, `post_liked`, and `post_commented` events
   - Updates unread items in real-time
   - Triggers browser Notification API when new posts/comments arrive (in non-compact mode)

### 3. Routing

#### Files Modified:

- **`client/src/layout/AppShell.jsx`** - Routes already configured (no changes needed)
- **`client/src/pages/social/SocialFeedPage.jsx`** - Uses route parameter to show single post

#### Route Configuration:

```jsx
<Route path="/social-feed" element={<SocialFeedPage />} />          // Full feed
<Route path="/social-feed/:id" element={<SocialFeedPage />} />     // Single post view
```

#### How It Works:

1. `SocialFeedPage` extracts route parameter `id` using `useParams()`
2. Passes `focusId` to `CompanyFeed` component
3. `CompanyFeed` filters posts to show only the one matching `focusId`
4. When `focusId` is null, shows full feed (default behavior)

### 4. Push Notification Payload Structure

When a push notification is triggered, the following payload is sent:

```javascript
{
  title: "New post from John Doe",
  body: "John Doe posted a new update",
  icon: "/logo.png",
  badge: "/badge.png",
  tag: "social-post",           // or "post-like", "post-comment"
  data: {
    url: "/social-feed/123",    // Post ID in URL
    type: "post",               // or "like", "comment"
    postId: 123                 // Numeric post ID
  }
}
```

## User Flow

### Scenario 1: User Receives New Post Notification

1. Another user creates a post
2. `triggerPostNotifications()` executes on backend
3. For each target user:
   - Database notification record is created
   - `sendPushToUser()` is called with push payload
   - Browser push notification appears (if subscribed and permitted)
4. On homepage, red badge appears at top-right of "What's on your mind" section
5. Badge shows count of unread items
6. User clicks badge → modal opens showing unread posts/comments
7. User clicks on unread post → navigates to `/social-feed/{postId}`
8. Only that single post is displayed with full details and comments

### Scenario 2: User Clicks Push Notification

1. Push notification appears on device
2. User clicks notification
3. App opens to `/social-feed/{postId}` (via `data.url` in payload)
4. Single post detail page loads

## Features

### Badge System

- **Floating Position**: Top-right corner of PostCreator card
- **Animation**: Pulsing red background for visibility
- **Count Display**: Shows number of unread items (capped at "99+")
- **Hover Effect**: Changes to darker red on hover
- **Accessibility**: Includes title attribute showing unread count

### Unread Modal

- **Fixed Overlay**: Blocks interaction with rest of page
- **List View**: Shows each unread item with:
  - User name (who posted/commented)
  - Content preview (first 100 chars, max 2 lines)
  - Item type label (New Post / New Comment)
- **Clickable**: Each item is clickable to navigate to post
- **Auto-Close**: Closes after item is selected
- **Close Button**: X button in top-right corner

### Push Notifications

- **Automatic**: Triggered on server when posts/comments/likes created
- **Targeted**: Sent only to relevant users (not to post creator)
- **Persistent**: Survives app closure (browser/OS handles display)
- **Clickable**: Clicking notification opens to dedicated post page
- **Smart Tags**: Different tags for posts/likes/comments (grouping)

## Database Integration

### Tables Used:

- `posts` - Post data
- `post_comments` - Comment data
- `post_likes` - Like records
- `adm_users` - User information (for names and profile pictures)
- `notifications` - Database notification records
- `adm_push_subscriptions` - Push subscription endpoints

### Notification Records:

Inserted into `notifications` table with:

- `user_id` - Target user receiving notification
- `type` - 'post_created', 'post_liked', or 'post_commented'
- `reference_id` - Post ID
- `title` - Display title
- `message` - Display message
- `is_read` - Initially 0 (unread)

## Real-Time Updates

### Socket.io Events:

- `new_post` - Broadcast when post created
- `post_liked` - Broadcast when post liked
- `post_commented` - Broadcast when comment added

### Frontend Listeners:

```javascript
socket.on("new_post", (newPost) => {
  // Add to unreadItems
  // Show notification
});

socket.on("post_commented", (data) => {
  // Add to unreadItems
  // Update post comment count
});
```

## Error Handling

### Push Notification Failures:

- If `sendPushToUser()` throws error, it's caught and logged
- Database notification is still created (doesn't fail the entire operation)
- Failed push subscriptions can be marked inactive (410/404 responses)

### Network Failures:

- Browser retries based on browser's network retry policy
- Failed fetches are caught and error messages displayed to user

## Browser Compatibility

### Required Features:

- **Service Workers** - For push notification handling
- **Web Push API** - For browser push notifications
- **localStorage** - For storing auth token
- **fetch API** - For HTTP requests
- **Socket.io Client** - For real-time updates

### Tested On:

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+ (limited push support)
- Edge 90+

## Configuration

### Environment Variables:

- `VAPID_PUBLIC_KEY` - For web push authentication
- `VAPID_PRIVATE_KEY` - For web push authentication
- `VAPID_CONTACT` - Contact email for push service

### Frontend Service Worker:

The app requires a service worker registered and responding to push events:

```javascript
self.addEventListener("push", (event) => {
  // Handle push notification
});
```

## Testing Checklist

- [ ] Create a new post - verify push notifications sent to all users
- [ ] Like a post - verify post owner receives notification
- [ ] Comment on a post - verify post owner receives notification
- [ ] Check badge appears on homepage after receiving notification
- [ ] Click badge to open unread modal
- [ ] Click unread item to navigate to post detail page
- [ ] Verify only one post displayed on detail page
- [ ] Test on multiple devices/browsers
- [ ] Close app and receive push notification
- [ ] Click push notification to open to correct post
- [ ] Verify badge disappears after reading all notifications

## Known Limitations

1. **Browser Notifications**: Requires user permission (Notification.requestPermission())
2. **Background Sync**: Not implemented (notifications won't trigger if service worker not active)
3. **Badge Persistence**: Resets on page refresh (data from server on load)
4. **Offline Support**: Requires service worker for offline notification queuing

## Future Enhancements

1. **Notification Preferences** - Let users control which notifications they receive
2. **Notification History** - Show read/unread history in a notification center
3. **Smart Grouping** - Combine similar notifications (e.g., "3 people liked your post")
4. **Sound/Vibration** - Add audio/haptic feedback options
5. **Background Sync** - Queue notifications when offline
6. **Notification Badges** - Show unread count in app icon
7. **Rich Notifications** - Include images/buttons in push notifications

## Related Files

- [Social Feed Implementation](SOCIAL_FEED_IMPLEMENTATION.md)
- [Social Feed API Routes](server/routes/social-feed.routes.js)
- [Push Routes](server/routes/push.routes.js)
- [Social Feed Controller](server/controllers/social-feed.controller.js)
- [CompanyFeed Component](client/src/components/CompanyFeed/CompanyFeed.jsx)
- [Social Feed Page](client/src/pages/social/SocialFeedPage.jsx)
