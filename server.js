const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'hekand-db.json');

if (!process.env.VERCEL) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      })
    : null;

const hash = s =>
  crypto.createHash('sha256').update(String(s)).digest('hex');

function initialState() {
  return {
    wos: [],
    inventory: [],
    sales: [],
    payroll: [],
    expenses: [],
    seq: { RP: 1, PT: 1, DT: 1 },
    currentUser: null,
    users: {
      owner: {
        username: 'owner',
        role: 'owner',
        passwordHash: hash('owner123')
      },
      admin: {
        username: 'admin',
        role: 'admin',
        passwordHash: hash('admin123')
      }
    },
    shareAllocations: {},
    shareHistory: [],
    shares: [
      { name: 'Owner 1', amount: 0 },
      { name: 'Owner 2', amount: 0 },
      { name: 'Investor 1', amount: 0 },
      { name: 'Investor 2', amount: 0 }
    ]
  };
}

function readLocalDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { state: initialState() };
  }
}

function writeLocalDB(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

if (!process.env.VERCEL && !fs.existsSync(DB_FILE)) {
  writeLocalDB({ state: initialState() });
}

async function readCentralState() {
  if (!supabase) {
    return readLocalDB().state;
  }

  const { data, error } = await supabase
    .from('app_state')
    .select('state')
    .eq('id', 'hekand')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const state = initialState();

    const { error: insertError } = await supabase
      .from('app_state')
      .insert({
        id: 'hekand',
        state
      });

    if (insertError) throw insertError;

    return state;
  }

  return data.state || initialState();
}

async function writeCentralState(state) {
  if (!supabase) {
    writeLocalDB({ state });
    return;
  }

  const { error } = await supabase
    .from('app_state')
    .upsert(
      {
        id: 'hekand',
        state,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}


/* =========================================================
   SECURE STATELESS SESSION
   ========================================================= */

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_ANON_KEY ||
  'hekand-session-secret';

function createToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function auth(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7);
  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  if (signature.length !== expected.length) {
    return null;
  }

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

    if (!data.username) {
      return null;
    }

    if (!data.exp || Date.now() > data.exp) {
      return null;
    }

    return data.username;
  } catch {
    return null;
  }
}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function json(res, status, obj) {
  const body = JSON.stringify(obj);

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  res.end(body);
}


/* =========================================================
   READ REQUEST BODY
   ========================================================= */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';

    req.on('data', c => {
      b += c;

      if (b.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch (e) {
        reject(e);
      }
    });

    req.on('error', reject);
  });
}


/* =========================================================
   STATIC FILE SERVER
   ========================================================= */

function serve(req, res) {
  let u = decodeURIComponent(req.url.split('?')[0]);

  if (u === '/') {
    u = '/index.html';
  }

  const file = path.join(ROOT, u);

  if (
    !file.startsWith(ROOT) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(file);

  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  };

  res.writeHead(200, {
    'Content-Type':
      types[ext] || 'application/octet-stream'
  });

  fs.createReadStream(file).pipe(res);
}


/* =========================================================
   SERVER
   ========================================================= */

const server = http.createServer(async (req, res) => {
  try {

    /* GET CENTRAL STATE */
    if (
      req.method === 'GET' &&
      req.url.startsWith('/api/state')
    ) {
      const user = auth(req);

      if (!user) {
        return json(res, 401, {
          error: 'Unauthorized'
        });
      }

      const state = await readCentralState();

      return json(res, 200, {
        state
      });
    }


    /* LOGIN */
    if (
      req.method === 'POST' &&
      req.url === '/api/login'
    ) {
      const b = await readBody(req);
      const state = await readCentralState();

      const username = String(
        b.username || ''
      ).toLowerCase();

      const user = state.users?.[username];

      if (
        !user ||
        user.passwordHash !== hash(b.password || '')
      ) {
        return json(res, 401, {
          error: 'Invalid credentials'
        });
      }

      const token = createToken(user.username);

      return json(res, 200, {
        token,
        state
      });
    }


    /* SAVE CENTRAL STATE */
    if (
      req.method === 'PUT' &&
      req.url === '/api/state'
    ) {
      const user = auth(req);

      if (!user) {
        return json(res, 401, {
          error: 'Unauthorized'
        });
      }

      const b = await readBody(req);

      if (!b || typeof b !== 'object') {
        return json(res, 400, {
          error: 'Invalid state'
        });
      }

      /*
       * currentUser is kept local to each device.
       * Central database stores the shared application state.
       */
      b.currentUser = null;

      await writeCentralState(b);

      return json(res, 200, {
        ok: true
      });
    }


    /* LOGOUT */
    if (
      req.method === 'POST' &&
      req.url === '/api/logout'
    ) {
      /*
       * Stateless token.
       * Nothing needs to be deleted from server memory.
       */

      return json(res, 200, {
        ok: true
      });
    }


    /* STATIC FILES */
    return serve(req, res);

  } catch (e) {

    console.error(e);

    return json(res, 500, {
      error: 'Server error',
      detail: e.message
    });
  }
});


if (require.main === module) {
  server.listen(PORT, () => {
    console.log(
      `HEKAND Auto Division v13 server listening on port ${PORT}`
    );
  });
}

module.exports = server;
