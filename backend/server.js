// server.js - Express backend for Instagram giveaway
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

// PostgreSQL connection via Supabase URL (as connection string)
const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper to fetch Instagram comments
async function fetchInstagramComments() {
  const url = `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_POST_ID}/comments?access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}&fields=id,username,text`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data || [];
}

// Regex to validate required mentions (default 5)
function hasRequiredMentions(text, min = 5) {
  const mentions = text.match(/@([\w.]+)/g) || [];
  return mentions.length >= min;
}

// Sync route: fetch, filter, store participants
app.get('/sync', async (req, res) => {
  try {
    const comments = await fetchInstagramComments();
    for (const c of comments) {
      // Insert raw comment, ignore duplicates
      await pool.query(
        `INSERT INTO comentarios (comment_id, username, comment) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [c.id, c.username, c.text]
      );
      // Check participation criteria and uniqueness
      const already = await pool.query('SELECT 1 FROM participantes WHERE username=$1', [c.username]);
      if (hasRequiredMentions(c.text) && !already.rowCount) {
        await pool.query(
          `INSERT INTO participantes (username, comment) VALUES ($1,$2)`,
          [c.username, c.text]
        );
      }
    }
    res.json({ status: 'synced', totalComments: comments.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Return up to 200 random participants
app.get('/participants', async (req, res) => {
  const result = await pool.query(`SELECT username, comment FROM participantes ORDER BY random() LIMIT 200`);
  res.json(result.rows);
});

// Record winner from frontend
app.post('/winner', async (req, res) => {
  const { username, comment, wheelHash } = req.body;
  const part = await pool.query('SELECT id FROM participantes WHERE username=$1', [username]);
  if (!part.rowCount) return res.status(404).json({ error: 'Participant not found' });
  await pool.query(
    `INSERT INTO ganadores (participante_id, wheel_hash) VALUES ($1,$2)`,
    [part.rows[0].id, wheelHash]
  );
  res.json({ status: 'recorded' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
