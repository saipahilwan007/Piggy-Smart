const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'piggysmart-super-secret-key-2026';

app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
// Serve static client assets directly from root
app.use(express.static(path.join(__dirname)));

let db;

// Initialize SQLite database
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'savings.db'),
    driver: sqlite3.Database
  });

  // Create Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  // Create Savings Log table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS savings (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      amount REAL,
      category TEXT,
      date TEXT,
      note TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY,
      monthly_goal REAL DEFAULT 1000,
      currency TEXT DEFAULT '$',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Register API Route
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username.toLowerCase().trim(), hashedPassword]
    );
    
    // Seed default settings for the new user
    await db.run(
      'INSERT INTO settings (user_id, monthly_goal, currency) VALUES (?, ?, ?)',
      [result.lastID, 1000, '$']
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username is already taken' });
    } else {
      res.status(500).json({ error: 'Database error occurred' });
    }
  }
});

// Login API Route
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.get(
      'SELECT * FROM users WHERE username = ?',
      [username.toLowerCase().trim()]
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token containing user info
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch user savings
app.get('/api/savings', authenticateToken, async (req, res) => {
  try {
    const savings = await db.all(
      'SELECT id, amount, category, date, note FROM savings WHERE user_id = ?',
      [req.user.id]
    );
    res.json(savings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve savings logs' });
  }
});

// Add savings entry
app.post('/api/savings', authenticateToken, async (req, res) => {
  const { id, amount, category, date, note } = req.body;
  if (!id || isNaN(amount) || amount <= 0 || !category || !date) {
    return res.status(400).json({ error: 'Invalid saving payload' });
  }

  try {
    await db.run(
      'INSERT INTO savings (id, user_id, amount, category, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.user.id, amount, category, date, note || '']
    );
    res.status(201).json({ message: 'Entry added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

// Delete savings entry
app.delete('/api/savings/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run(
      'DELETE FROM savings WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Saving entry not found' });
    }
    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Fetch user settings
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db.get(
      'SELECT monthly_goal, currency FROM settings WHERE user_id = ?',
      [req.user.id]
    );
    res.json(settings || { monthly_goal: 1000, currency: '$' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Save / Update user settings
app.post('/api/settings', authenticateToken, async (req, res) => {
  const { monthly_goal, currency } = req.body;
  if (isNaN(monthly_goal) || monthly_goal <= 0 || !currency) {
    return res.status(400).json({ error: 'Invalid settings configuration' });
  }

  try {
    await db.run(
      `INSERT INTO settings (user_id, monthly_goal, currency) 
       VALUES (?, ?, ?) 
       ON CONFLICT(user_id) DO UPDATE SET 
         monthly_goal = excluded.monthly_goal, 
         currency = excluded.currency`,
      [req.user.id, monthly_goal, currency]
    );
    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Fallback to serve index.html for UI client-side rendering
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Database and Server Bootstrap
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`PiggySmart backend running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
