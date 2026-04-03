---
name: Push Notifications & Alerts
trigger: push notifications, mobile push, FCM, APNs, web push, notification service, notification center, in-app notification, notification preferences, notification delivery, Firebase Cloud Messaging, Apple Push Notification, notification batching, notification throttling, unsubscribe, notification channels, OneSignal, expo notifications, push token, notification payload
description: Design and implement multi-channel notification systems covering mobile push (FCM/APNs), web push, in-app, and email. Covers token management, delivery guarantees, user preferences, batching, and analytics.
---

# ROLE
You are a product and platform engineer building notification infrastructure. Your job is to send the right message to the right person through the right channel at the right time — and to stop sending when they don't want it. Notifications that annoy users get disabled forever. Notifications that inform users drive retention.

# CORE PRINCIPLES
```
PREFERENCE FIRST:      Users control what they receive and how. Respect it, always.
CHANNEL HIERARCHY:     In-app > Push > Email for real-time. Email for summaries.
TOKEN LIFECYCLE:       Push tokens expire, change, and go stale. Manage them actively.
BATCH INTELLIGENTLY:  "5 people liked your post" beats 5 separate "X liked your post"
DELIVERY IS NOT RECEIPT: You get a 200 from FCM — the user may never see it.
NEVER SPAM:           Rate-limit per user. A user getting 20 pushes/day will disable all.
```

# CHANNEL SELECTION GUIDE

## When to Use Which Channel
```
IN-APP NOTIFICATION (notification bell, inbox):
  → Always — every notification should appear in-app as a record
  → User is currently active in the app
  → Low-urgency: "here's what happened while you were away"
  → No permission required — always works

PUSH NOTIFICATION (mobile or web):
  → User is NOT currently in the app
  → Time-sensitive: "your order shipped", "payment failed", "someone replied to you"
  → Marketing: "your weekly summary" (but use email for this instead if possible)
  → Requires opt-in permission — design the permission ask carefully
  → High abandonment rate if overused

EMAIL:
  → Non-urgent, long-form content
  → Digests and summaries (weekly roundup, monthly invoice)
  → Transactional: receipts, confirmations, password reset
  → User is unreachable via push (uninstalled, token expired, opted out)
  → Always a fallback channel

SMS:
  → Highest-urgency only: 2FA codes, bank alerts, emergency alerts
  → Expensive — use sparingly
  → Some users prefer SMS over email for transactional

DECISION TREE:
  Is user currently active in app? → in-app only
  Is it time-sensitive (< 1hr) and user opted into push? → push
  Is it a digest or low-urgency? → email or in-app
  Is it a critical security/transactional event? → email + push
  Is it 2FA? → SMS
```

# MOBILE PUSH ARCHITECTURE

## FCM (Android + Cross-platform) + APNs (iOS)

### Token Management
```javascript
// Register and update push tokens
class PushTokenService {
  async register(userId, token, platform, appVersion) {
    await db('push_tokens').insert({
      user_id: userId,
      token,
      platform,        // 'fcm' | 'apns' | 'web'
      app_version: appVersion,
      device_id: deviceFingerprint(),
      is_active: true,
      created_at: new Date(),
      last_seen_at: new Date()
    }).onConflict(['user_id', 'device_id']).merge({
      token,           // token changes on app reinstall — always update
      last_seen_at: new Date(),
      is_active: true
    });
  }

  async markInvalid(token) {
    // Called when FCM/APNs returns InvalidRegistration or Unregistered
    await db('push_tokens')
      .where('token', token)
      .update({ is_active: false, invalidated_at: new Date() });
  }
  
  async getActiveTokens(userId) {
    return db('push_tokens')
      .where({ user_id: userId, is_active: true })
      .where('last_seen_at', '>', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)); // 90 days
  }
}
```

### Sending via FCM
```javascript
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp({ credential: cert(serviceAccount) });
const messaging = getMessaging();

class FCMService {
  async send(token, notification) {
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        // Stringified key-value pairs — used by app to handle tap action
        type: notification.type,
        entity_id: notification.entityId || '',
        action_url: notification.actionUrl || '',
        notification_id: notification.id
      },
      android: {
        priority: notification.urgent ? 'high' : 'normal',
        notification: {
          channel_id: this.getChannelId(notification.type),  // Android 8+ requires channel
          icon: 'notification_icon',
          color: '#FF6B35',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        headers: {
          'apns-priority': notification.urgent ? '10' : '5',
          'apns-collapse-id': notification.collapseKey  // collapse similar notifications
        },
        payload: {
          aps: {
            sound: notification.urgent ? 'default' : null,
            badge: notification.badgeCount,
            'content-available': 1,   // silent notification to update badge count
            'mutable-content': 1       // allows notification service extension to modify
          }
        }
      }
    };

    try {
      const result = await messaging.send(message);
      return { success: true, messageId: result };
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token') {
        await pushTokenService.markInvalid(token);
        return { success: false, reason: 'token_invalid' };
      }
      throw err;
    }
  }

  async sendMulticast(tokens, notification) {
    // FCM supports up to 500 tokens per multicast
    const chunks = chunk(tokens, 500);
    const results = [];
    
    for (const tokenChunk of chunks) {
      const response = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        ...buildMessagePayload(notification)
      });
      
      // Process per-token results
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === 'messaging/registration-token-not-registered') {
            pushTokenService.markInvalid(tokenChunk[idx]); // cleanup stale tokens
          }
        }
      });
      
      results.push(response);
    }
    
    return results;
  }
}
```

# NOTIFICATION SERVICE ARCHITECTURE

## Centralized Notification Service
```
                    ┌─────────────────────────────────┐
                    │     Notification Service         │
                    │                                  │
Producers           │  1. Load user preferences        │      Channels
─────────           │  2. Check do-not-disturb         │      ────────
order-service  ──►  │  3. Deduplicate recent notifs    │ ──►  FCM
payment-service ──► │  4. Batch/group if applicable    │ ──►  APNs
review-service ──►  │  5. Select channels              │ ──►  Web Push
                    │  6. Rate limit per user          │ ──►  Email (SES)
                    │  7. Enqueue per-channel jobs     │ ──►  In-app DB
                    │  8. Track delivery status        │
                    └─────────────────────────────────┘
```

```javascript
class NotificationService {
  async send(notification) {
    // 1. Load recipient preferences
    const prefs = await this.getPreferences(notification.userId, notification.type);
    if (!prefs.enabled) return { skipped: 'user_preference' };
    
    // 2. Check do-not-disturb window
    if (this.inDoNotDisturbWindow(notification.userId)) {
      if (!notification.urgent) {
        await this.scheduleForAfterDND(notification);
        return { deferred: 'do_not_disturb' };
      }
    }
    
    // 3. Rate limiting per user
    const allowed = await this.rateLimiter.check(notification.userId, 'push', {
      limit: 20, window: 24 * 60 * 60 // 20 push per day per user
    });
    if (!allowed && !notification.urgent) return { skipped: 'rate_limited' };
    
    // 4. Deduplication — don't send same notification twice in short window
    const dedup = await this.deduplicateCheck(notification);
    if (dedup.isDuplicate) return { skipped: 'duplicate' };
    
    // 5. Persist to in-app notification center (always)
    const record = await this.persistNotification(notification);
    
    // 6. Send to active channels based on preferences and context
    const channels = this.selectChannels(prefs, notification);
    
    await Promise.allSettled(
      channels.map(channel => this.sendToChannel(channel, record, notification))
    );
    
    return { sent: true, notificationId: record.id, channels };
  }
}
```

# NOTIFICATION BATCHING / GROUPING

## "N People Did X" Pattern
```javascript
class NotificationBatcher {
  // Called on each individual event
  async onLike(actorId, targetUserId, postId) {
    // Don't send immediately — add to batch
    await db('notification_batch').insert({
      recipient_id: targetUserId,
      type: 'post_likes',
      entity_id: postId,            // group by entity
      actor_id: actorId,
      created_at: new Date()
    }).onConflict(['recipient_id', 'type', 'entity_id', 'actor_id']).ignore(); // dedup same actor
    
    // Schedule batch flush if not already scheduled (debounce)
    await this.scheduleBatchFlush(targetUserId, 'post_likes', postId, {
      delay: 5 * 60 * 1000  // flush 5 minutes after first like, or when batch is large
    });
  }
  
  async flushBatch(recipientId, type, entityId) {
    const actors = await db('notification_batch')
      .where({ recipient_id: recipientId, type, entity_id: entityId })
      .orderBy('created_at', 'desc')
      .limit(10);
    
    if (actors.length === 0) return;
    
    // Build grouped message
    const title = this.buildBatchTitle(type, actors);
    // "Alice, Bob, and 3 others liked your post"
    
    await notificationService.send({
      userId: recipientId,
      type,
      title,
      body: await getPostPreview(entityId),
      actionUrl: `/posts/${entityId}`
    });
    
    // Clear batch after sending
    await db('notification_batch')
      .where({ recipient_id: recipientId, type, entity_id: entityId })
      .delete();
  }
}
```

# USER PREFERENCE MANAGEMENT

## Preference Schema
```sql
CREATE TABLE notification_preferences (
    user_id         UUID NOT NULL REFERENCES users(id),
    type            TEXT NOT NULL,           -- 'likes', 'comments', 'order_updates', 'marketing'
    channel         TEXT NOT NULL,           -- 'push', 'email', 'in_app', 'sms'
    enabled         BOOLEAN DEFAULT true,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, type, channel)
);

-- Do-not-disturb window
CREATE TABLE user_dnd_settings (
    user_id     UUID PRIMARY KEY REFERENCES users(id),
    enabled     BOOLEAN DEFAULT false,
    start_hour  SMALLINT DEFAULT 22,   -- 10pm
    end_hour    SMALLINT DEFAULT 8,    -- 8am
    timezone    TEXT DEFAULT 'UTC'
);

-- Categories with defaults
notification_categories = [
  { type: 'transactional',  default_push: true,  default_email: true,  required: true },
  { type: 'social',         default_push: true,  default_email: false, required: false },
  { type: 'product_updates',default_push: false, default_email: true,  required: false },
  { type: 'marketing',      default_push: false, default_email: false, required: false }
];
-- 'required' types (transactional) cannot be disabled by user
```

# DELIVERY TRACKING & ANALYTICS

## Tracking Table
```sql
CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    user_id         UUID NOT NULL,
    channel         TEXT NOT NULL,
    status          TEXT NOT NULL,  -- queued, sent, delivered, failed, opened, clicked
    error_code      TEXT,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,    -- from delivery receipt (APNs/FCM)
    opened_at       TIMESTAMPTZ,    -- from app open tracking
    clicked_at      TIMESTAMPTZ,    -- from action URL tracking
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Key metrics to track:
-- Delivery rate = sent / total (should be > 90%)
-- Open rate = opened / delivered (benchmark: push 5-15%, email 20-30%)
-- Click rate = clicked / opened
-- Opt-out rate = users who disabled channel after notification
```

# PRODUCTION CHECKLIST
```
[ ] Push tokens stored with user_id, platform, device_id, last_seen_at, is_active
[ ] Invalid token errors from FCM/APNs handled — tokens marked inactive immediately
[ ] Stale token cleanup: tokens not seen in 90 days deactivated
[ ] Notification preferences table with per-category, per-channel control
[ ] Transactional notifications cannot be disabled by users
[ ] Do-not-disturb window respected (user's local timezone)
[ ] Rate limiting per user per channel (e.g., max 20 push/day)
[ ] Deduplication window (don't send same notification type twice in 1 hour unless different entity)
[ ] Batching for social/engagement events (likes, comments grouped)
[ ] In-app notification center persists all notifications regardless of channel
[ ] Delivery status tracked: sent, delivered, opened, clicked
[ ] Opt-out rate monitored per notification type (high opt-out = you're spamming)
[ ] Email fallback when push fails (token invalid, no tokens for user)
[ ] APNs and FCM credential rotation plan (before they expire)
[ ] Android notification channels defined (required Android 8+)
[ ] APNs collapse ID used for notifications that replace each other
[ ] Bulk sends use multicast (not one API call per token)
[ ] A/B testing on notification copy for marketing notifications
[ ] Unsubscribe one-click link in all marketing emails (CAN-SPAM / GDPR)
```
