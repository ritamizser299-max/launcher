# News API Specification for RobBob Website

## Overview

This document describes the API endpoint and admin panel requirements for managing launcher news via the RobBob website (https://robbob.ru).

## API Endpoint

### GET /api/news

Returns a list of news items for the launcher.

**URL:** `https://robbob.ru/api/news`

**Method:** GET

**Headers:**
- Accept: application/json

**Response Format:**
```json
{
  "news": [
    {
      "id": "unique-id-1",
      "title": "Заголовок новости",
      "emoji": "rocket",
      "content": "Текст новости...",
      "date": "2024-12-16",
      "pinned": true,
      "link": "https://example.com/optional-link"
    }
  ]
}
```

**Fields:**
- `id` (string, required) - Unique identifier for the news item
- `title` (string, required) - News title
- `emoji` (string, required) - Emoji identifier (see available options below)
- `content` (string, required) - News content text
- `date` (string, required) - ISO date format YYYY-MM-DD
- `pinned` (boolean, optional) - Whether the news item should be pinned to top
- `link` (string, optional) - Optional external link for "Read more"

**Available Emoji Identifiers:**
- `rocket` - 🚀
- `shield` - 🛡️
- `zap` - ⚡
- `star` - ⭐
- `fire` - 🔥
- `gift` - 🎁
- `warning` - ⚠️
- `info` - ℹ️
- `check` - ✅
- `new` - 🆕
- `update` - 📦
- `bug` - 🐛
- `fix` - 🔧
- `sparkles` - ✨
- `game` - 🎮
- `network` - 🌐

## CORS Configuration

The API must include CORS headers to allow requests from the Electron app:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Accept
```

## Admin Panel Requirements

The admin panel should include a "News Management" section with the following features:

### Features

1. **List News** - Table view with all news items
2. **Create News** - Form to add new news items
3. **Edit News** - Form to edit existing news
4. **Delete News** - Delete functionality with confirmation
5. **Pin/Unpin News** - Toggle pinned status
6. **Reorder News** - Drag-and-drop or up/down buttons

### Admin Panel UI Components

**News List Table:**
- ID
- Title
- Emoji (preview)
- Date
- Pinned (badge)
- Actions (Edit, Delete)

**Create/Edit Form:**
- Title (text input)
- Emoji (dropdown selector with preview)
- Content (textarea)
- Date (date picker, default to today)
- Pinned (checkbox)
- Link (optional URL input)

## Database Schema (Example for MongoDB/SQL)

```javascript
// MongoDB Schema
const NewsSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  emoji: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: String, required: true },
  pinned: { type: Boolean, default: false },
  link: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

## Example Implementation (Node.js/Express)

```javascript
// routes/api/news.js
const express = require('express');
const router = express.Router();
const News = require('../models/News');

// GET /api/news
router.get('/', async (req, res) => {
  try {
    const newsItems = await News.find().sort({ pinned: -1, date: -1 });
    res.json({ news: newsItems });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

module.exports = router;
```

## Testing

After implementing the API, verify:

1. **Endpoint returns valid JSON:**
   ```bash
   curl -H "Accept: application/json" https://robbob.ru/api/news
   ```

2. **CORS headers are present:**
   ```bash
   curl -I -H "Origin: http://localhost" https://robbob.ru/api/news
   ```

3. **Launcher can fetch news:**
   - Open RobBob Launcher
   - Check developer console for successful news fetch
   - Verify news cards display correctly

## Notes

- The launcher has a 5-minute cache for news
- The launcher will fall back to GitHub Gist if the API is unavailable
- News with `pinned: true` will always appear at the top
- The ID field should be unique and stable (UUID recommended)
