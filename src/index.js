// ============================================
// ETTI RADIO — CLOUDFLARE WORKER BACKEND
// ============================================
// Handles: live stream link, manual blog posts, and the video archive
// (auto-filled whenever a broadcast ends). Uses D1 (SQLite) for storage.
// ============================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // ---------- Live status ----------
      if (path === '/api/live' && method === 'GET') {
        const row = await env.DB.prepare('SELECT live_url, updated_at FROM live_status WHERE id = 1').first();
        return json({ liveUrl: row?.live_url || '', updatedAt: row?.updated_at || null });
      }

      if (path === '/api/live' && method === 'POST') {
        const body = await request.json();
        const { liveUrl, password } = body;

        if (password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }

        const current = await env.DB.prepare('SELECT live_url FROM live_status WHERE id = 1').first();
        const newUrl = (liveUrl || '').trim();

        // If ending a broadcast (newUrl empty) and there was a live link,
        // automatically archive it as a video
        if (newUrl === '' && current?.live_url) {
          await env.DB.prepare(
            'INSERT INTO videos (title, video_url) VALUES (?, ?)'
          ).bind('Broadcast — ' + new Date().toLocaleDateString(), current.live_url).run();
        }

        await env.DB.prepare(
          'UPDATE live_status SET live_url = ?, updated_at = datetime("now") WHERE id = 1'
        ).bind(newUrl).run();

        return json({ success: true, liveUrl: newUrl });
      }

      // ---------- Blog posts ----------
      if (path === '/api/posts' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM posts ORDER BY created_at DESC LIMIT 100'
        ).all();
        return json({ posts: results });
      }

      if (path === '/api/posts' && method === 'POST') {
        const body = await request.json();
        const { title, content, imageUrl, author, password } = body;

        if (password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }
        if (!title || !content) {
          return json({ error: 'Title and content are required' }, 400);
        }

        const result = await env.DB.prepare(
          'INSERT INTO posts (title, content, image_url, author) VALUES (?, ?, ?, ?)'
        ).bind(title.trim(), content.trim(), (imageUrl || '').trim(), (author || '').trim()).run();

        return json({ success: true, id: result.meta.last_row_id });
      }

      const postIdMatch = path.match(/^\/api\/posts\/(\d+)$/);
      if (postIdMatch && method === 'DELETE') {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }
        await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postIdMatch[1]).run();
        return json({ success: true });
      }

      if (postIdMatch && method === 'PUT') {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }
        await env.DB.prepare(
          'UPDATE posts SET title = ?, content = ?, image_url = ?, author = ? WHERE id = ?'
        ).bind(body.title.trim(), body.content.trim(), (body.imageUrl || '').trim(), (body.author || '').trim(), postIdMatch[1]).run();
        return json({ success: true });
      }

      // ---------- Video archive ----------
      if (path === '/api/videos' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM videos ORDER BY created_at DESC LIMIT 100'
        ).all();
        return json({ videos: results });
      }

      // Manual add, in case a producer wants to add an older video too
      if (path === '/api/videos' && method === 'POST') {
        const body = await request.json();
        const { title, videoUrl, password } = body;

        if (password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }
        if (!videoUrl) {
          return json({ error: 'Video URL is required' }, 400);
        }

        const result = await env.DB.prepare(
          'INSERT INTO videos (title, video_url) VALUES (?, ?)'
        ).bind((title || '').trim(), videoUrl.trim()).run();

        return json({ success: true, id: result.meta.last_row_id });
      }

      const videoIdMatch = path.match(/^\/api\/videos\/(\d+)$/);
      if (videoIdMatch && method === 'DELETE') {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) {
          return json({ error: 'Wrong password' }, 401);
        }
        await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoIdMatch[1]).run();
        return json({ success: true });
      }

      if (path === '/' || path === '') {
        return new Response('ETTI Radio Worker backend is running.', { headers: CORS_HEADERS });
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      return json({ error: 'Server error: ' + err.message }, 500);
    }
  },
};
