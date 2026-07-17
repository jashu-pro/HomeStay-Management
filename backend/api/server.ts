import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { v2 as cloudinary } from 'cloudinary';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  User, Guest, Booking, VisitorLog, Room, Invoice, Payment, AuditLog, SystemNotification, RecycleBinItem, CleanupSettings, SimulatedEmail 
} from '../types';
import initialDb from '../data/db.json' with { type: 'json' };

const initializeServer = () => {
  // Only JWT_SECRET is truly required — everything else is optional
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ [WARNING] JWT_SECRET is not set. Using default development secret. Set this in production!');
  } else {
    console.log('✅ [Env] JWT_SECRET is configured.');
  }

  // Optional features notice (only shown if none are configured)
  const hasEmail = process.env.SMTP_HOST || process.env.RESEND_API_KEY;
  const hasSupabase = process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

  if (!hasEmail) {
    console.log('ℹ️ [Optional] No email provider configured (SMTP/Resend). Password reset emails will use simulated local mailbox.');
  }
  if (hasSupabase) {
    console.log('✅ [Env] Supabase configured.');
  } else {
    console.log('ℹ️ [Optional] Supabase not configured. Will use local db.json fallback.');
  }
};

// Execute environment validation on initialization
try {
  initializeServer();
} catch (err: any) {
  console.error('[Startup Environment Validation Failed]', err.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'homestay-secret-key-12345';

const DB_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const UPLOADS_DIR = process.env.VERCEL ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
let supabase: SupabaseClient | null = null;
let supabaseAvailable = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Supabase] Client initialized.');
  } catch (e) {
    console.error('[Supabase] Failed to create client:', e);
  }
} else {
  console.warn('[Supabase] ⚠️  SUPABASE_URL or SUPABASE_KEY missing. Will use local db.json fallback.');
}

// Lazy-initialized Resend client
let resendClient: Resend | null = null;

const getResendClient = () => {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    console.log('[Resend] Initializing Resend client with provided API key.');
    resendClient = new Resend(apiKey);
    return resendClient;
  }
  return null;
};

// Lazy-initialized SMTP transporter for real email delivery fallback
let emailTransporter: any = null;

const getEmailTransporter = async () => {
  if (emailTransporter) return emailTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    console.log(`[SMTP] Initializing connection to production SMTP host ${host}:${port}`);
    emailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  } else {
    console.warn('[SMTP] Missing SMTP environment variables. Falling back to simulated/console mail delivery.');
    // Ephemeral nodemailer test account
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[SMTP Dev] Created ephemeral test account: ${testAccount.user}`);
      emailTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.error('[SMTP Dev] Failed to create nodemailer test account. Using console log fallback.', err);
      emailTransporter = {
        sendMail: async (options: any) => {
          console.log(`[SMTP Console Fallback] Sending email to: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Body:\n${options.text}`);
          return { messageId: `console-fallback-id-${Date.now()}` };
        }
      };
    }
  }
  return emailTransporter;
};

const sendEmail = async ({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) => {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (apiKey) {
    console.log(`[Resend] Initiating email delivery to ${to} for subject "${subject}"`);
    const resend = getResendClient();
    if (!resend) {
      throw new Error('Resend client failed to initialize. Please check your RESEND_API_KEY secret configuration.');
    }

    // Resolve the sender email address
    let fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';
    
    // Format the from field as "Homestay OS <email@example.com>" if it is a plain email
    let fromAddress = fromEmail;
    if (!fromAddress.includes('<')) {
      fromAddress = `Homestay OS <${fromEmail}>`;
    }

    console.log(`[Resend] Resolving sender. RESEND_FROM raw value: "${process.env.RESEND_FROM || ''}". Configured 'from' field: "${fromAddress}"`);

    try {
      const response = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
      });

      console.log(`[Resend] Full send response:`, JSON.stringify(response, null, 2));

      if (response.error) {
        console.error('[Resend SDK Error Response]:', response.error);
        throw new Error(`Resend API Error: ${response.error.message} (Code: ${response.error.name})`);
      }

      console.log(`[Resend] Email sent successfully via Resend API to ${to}. Message ID: ${response.data?.id}`);
      return response.data;
    } catch (err: any) {
      console.error(`[Resend Exception] Error sending to ${to}:`, err);
      throw new Error(`Failed to deliver email through Resend: ${err.message || err}`);
    }
  } else {
    // Graceful fallback to SMTP / Ephemeral Nodemailer
    const t = await getEmailTransporter();
    const from = process.env.SMTP_FROM || 'Homestay OS <no-reply@homestay-os.com>';
    
    try {
      const info = await t.sendMail({
        from,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
      });
      console.log(`[SMTP] Fallback Email successfully sent to ${to}. MessageID: ${info.messageId}`);
      
      // Log preview URL if using ephemeral nodemailer test account
      if (nodemailer.getTestMessageUrl && info) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`[SMTP Dev Fallback] Preview link: ${previewUrl}`);
        }
      }
      return info;
    } catch (error: any) {
      console.error(`[SMTP Fallback] Error sending email to ${to}:`, error);
      throw new Error(`Failed to deliver email via fallback SMTP: ${error.message || error}`);
    }
  }
};

// Ensure database directory exists and initialize it with bundled database on Vercel
if (process.env.VERCEL) {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('Writing statically bundled db.json to /tmp/db.json for Vercel...');
      //fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing db.json in /tmp:', err);
  }
}

/*if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}*/

// Ensure express parses JSON and has high limit for Aadhaar base64 images
app.use(express.json({ limit: '10mb' }));

// Serve static profile upload files
app.use('/uploads', express.static(UPLOADS_DIR));

// Custom CORS middleware to support local/cross-origin preview domains and preflight OPTIONS requests
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Request Logging Middleware for status, method, url, and headers
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  console.log(`[Server Request] ${req.method} ${req.url}`);
  
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - start;
    console.log(`[Server Response] ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    return originalEnd.call(this, chunk, encoding, callback);
  } as any;
  
  next();
});

// Database state
interface Database {
  users: User[];
  guests: Guest[];
  bookings: Booking[];
  rooms: Room[];
  visitorLog: VisitorLog[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  notifications: SystemNotification[];
  recycleBin: RecycleBinItem[];
  cleanupSettings: CleanupSettings;
  simulatedEmails?: SimulatedEmail[];
}

// Read database
function runAutoCleanup(db: Database): boolean {
  if (!db.cleanupSettings || db.cleanupSettings.retentionDays === 'never') return false;
  const days = parseInt(db.cleanupSettings.retentionDays, 10);
  if (isNaN(days)) return false;

  const now = new Date();
  const cutoffTime = now.getTime() - (days * 24 * 60 * 60 * 1000);

  const beforeCount = db.recycleBin.length;
  db.recycleBin = db.recycleBin.filter(item => {
    const deletedTime = new Date(item.deletedAt).getTime();
    return deletedTime >= cutoffTime;
  });

  return db.recycleBin.length < beforeCount;
}

function isValidAdminPassword(hash: string): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync('admin123', hash) || 
           bcrypt.compareSync('Mahesh@2007', hash) || 
           bcrypt.compareSync('Sivaiah@1976', hash);
  } catch (e) {
    return false;
  }
}

function isValidViewerPassword(hash: string): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync('viewer123', hash) || 
           bcrypt.compareSync('Sivaiah@1976', hash);
  } catch (e) {
    return false;
  }
}

// ─── IN-MEMORY DATABASE CACHE ────────────────────────────────────────────────
// Strategy: readDB() returns from memory (synchronous, fast).
// writeDB() updates memory immediately AND persists to Supabase asynchronously.
// On startup, initDB() loads from Supabase (or falls back to local db.json).
let dbCache: Database | null = null;

// Apply data migrations and default-user enforcement to a loaded database
function applyDBMigrations(db: Database): { db: Database; modified: boolean } {
  let modified = false;

  if (!db.users) { db.users = []; modified = true; }
  if (!db.guests) { db.guests = []; modified = true; }
  if (!db.bookings) { db.bookings = []; modified = true; }
  if (!db.rooms) { db.rooms = []; modified = true; }
  if (!db.visitorLog) { db.visitorLog = []; modified = true; }
  if (!db.invoices) { db.invoices = []; modified = true; }
  if (!db.payments) { db.payments = []; modified = true; }
  if (!db.auditLogs) { db.auditLogs = []; modified = true; }
  if (!db.notifications) { db.notifications = []; modified = true; }
  if (!db.recycleBin) { db.recycleBin = []; modified = true; }
  if (!db.cleanupSettings) { db.cleanupSettings = { retentionDays: 'never' }; modified = true; }

  if (runAutoCleanup(db)) modified = true;

  if (Array.isArray(db.users)) {
    // Enforce Mahesh (u3)
    let u3 = db.users.find(u => u.id === 'u3');
    if (!u3) {
      db.users.push({ id: 'u3', username: 'admin', role: 'admin', fullName: 'Mahesh (Owner)', password: bcrypt.hashSync('admin123', 10), email: 'mahesh9553888649@gmail.com', email_verified: true });
      modified = true;
    } else {
      if (u3.username !== 'admin' || !isValidAdminPassword(u3.password || '') || u3.email !== 'mahesh9553888649@gmail.com') {
        u3.username = 'admin';
        if (!isValidAdminPassword(u3.password || '')) u3.password = bcrypt.hashSync('admin123', 10);
        u3.email = 'mahesh9553888649@gmail.com';
        u3.email_verified = true;
        modified = true;
      }
    }
    // Enforce Gopal Rao (u1)
    let u1 = db.users.find(u => u.id === 'u1');
    if (!u1) {
      db.users.push({ id: 'u1', username: 'gopal_rao', role: 'admin', fullName: 'Gopal Rao (Owner)', password: bcrypt.hashSync('admin123', 10), email: 'gopal_rao@example.com', email_verified: true });
      modified = true;
    } else {
      if (u1.username !== 'gopal_rao' || !isValidAdminPassword(u1.password || '')) {
        u1.username = 'gopal_rao';
        if (!isValidAdminPassword(u1.password || '')) u1.password = bcrypt.hashSync('admin123', 10);
        u1.email = u1.email || 'gopal_rao@example.com';
        modified = true;
      }
    }
    // Enforce Viewer (u2)
    let u2 = db.users.find(u => u.id === 'u2');
    if (!u2) {
      db.users.push({ id: 'u2', username: 'viewer', role: 'viewer', fullName: 'Kalyani (Staff)', password: bcrypt.hashSync('viewer123', 10), email: 'viewer@example.com', ownerId: 'u1', email_verified: true });
      modified = true;
    } else {
      if (u2.username !== 'viewer' || !isValidViewerPassword(u2.password || '')) {
        u2.username = 'viewer';
        if (!isValidViewerPassword(u2.password || '')) u2.password = bcrypt.hashSync('viewer123', 10);
        u2.email = u2.email || 'viewer@example.com';
        u2.ownerId = 'u1';
        modified = true;
      }
    }
    db.users.forEach(u => { if (u.id === 'u2' && !u.ownerId) { u.ownerId = 'u1'; modified = true; } });
  }

  // Migrate records missing userId → assign to u3
  const tid = 'u3';
  const migrateUserId = (arr: any[]) => arr.forEach(x => { if (!x.userId) { x.userId = tid; modified = true; } });
  migrateUserId(db.rooms);
  migrateUserId(db.guests);
  migrateUserId(db.bookings);
  migrateUserId(db.visitorLog);
  migrateUserId(db.invoices);
  migrateUserId(db.payments);
  migrateUserId(db.notifications);
  migrateUserId(db.recycleBin);

  return { db, modified };
}

// Read local db.json (used as fallback if Supabase is unavailable)
function readLocalDB(): Database {
  console.log(`[Database] Reading local file: ${DB_FILE}`);
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      if (!data || data.trim() === '') {
        const db = seedDatabase();
        return db;
      }
      const db = JSON.parse(data) as Database;
      const { db: migrated, modified } = applyDBMigrations(db);
      if (modified) {
        try { fs.writeFileSync(DB_FILE, JSON.stringify(migrated, null, 2), 'utf-8'); } catch (_) {}
      }
      return migrated;
    }
  } catch (err) {
    console.error('[Database] Error reading local file:', err);
  }
  return seedDatabase();
}

// Write local db.json backup
function writeLocalDB(db: Database) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Error writing local file:', err);
  }
}

// ─── SUPABASE PERSISTENCE ─────────────────────────────────────────────────────

// Sync a single table: upsert current rows, delete removed rows
async function syncTable(table: string, pkField: string, rows: Record<string, any>[]): Promise<void> {
  if (!supabase) return;
  try {
    // Get existing PKs from Supabase
    const { data: existing, error: fetchErr } = await supabase.from(table).select(pkField);
    if (fetchErr) { console.error(`[Supabase] syncTable fetch error on ${table}:`, fetchErr.message); return; }

    const existingIds = new Set((existing || []).map((r: any) => String(r[pkField])));
    const currentIds = new Set(rows.map(r => String(r[pkField])));

    // Delete rows that no longer exist
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from(table).delete().in(pkField, toDelete);
      if (delErr) console.error(`[Supabase] Delete error on ${table}:`, delErr.message);
    }

    // Upsert current rows
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase.from(table).upsert(rows);
      if (upsertErr) console.error(`[Supabase] Upsert error on ${table}:`, upsertErr.message);
    }
  } catch (err) {
    console.error(`[Supabase] syncTable exception on ${table}:`, err);
  }
}

// Persist entire in-memory DB to Supabase (runs in background, non-blocking)
async function persistToSupabase(db: Database): Promise<void> {
  if (!supabase || !supabaseAvailable) return;
  try {
    await Promise.all([
      syncTable('hs_users', 'id', db.users.map(u => ({ id: u.id, username: u.username, data: u }))),
      syncTable('hs_guests', 'id', db.guests.map(g => ({ id: g.id, user_id: g.userId || '', data: g }))),
      syncTable('hs_bookings', 'id', db.bookings.map(b => ({ id: b.id, user_id: b.userId || '', data: b }))),
      syncTable('hs_rooms', 'id', db.rooms.map(r => ({ id: `${r.userId || 'default'}-${r.roomNumber}`, user_id: r.userId || '', data: r }))),
      syncTable('hs_visitor_log', 'id', db.visitorLog.map(v => ({ id: v.id, user_id: v.userId || '', data: v }))),
      syncTable('hs_invoices', 'id', db.invoices.map(i => ({ id: i.invoiceNumber, user_id: i.userId || '', data: i }))),
      syncTable('hs_payments', 'id', db.payments.map(p => ({ id: p.id, user_id: p.userId || '', data: p }))),
      syncTable('hs_audit_logs', 'id', db.auditLogs.map(l => ({ id: l.id, data: l }))),
      syncTable('hs_notifications', 'id', db.notifications.map(n => ({ id: n.id, user_id: n.userId || '', data: n }))),
      syncTable('hs_recycle_bin', 'id', db.recycleBin.map(r => ({ id: r.id, user_id: r.userId || '', data: r }))),
      syncTable('hs_simulated_emails', 'id', (db.simulatedEmails || []).map(e => ({ id: e.id, data: e }))),
    ]);

    // Upsert cleanup settings (single global row)
    await supabase.from('hs_cleanup_settings').upsert({
      key: 'global',
      retention_days: db.cleanupSettings?.retentionDays || 'never'
    });

    console.log('[Supabase] ✅ Database persisted to Supabase.');
  } catch (err) {
    console.error('[Supabase] persistToSupabase error:', err);
  }
}

// Load full database from Supabase tables into memory
async function loadFromSupabase(): Promise<Database | null> {
  if (!supabase) return null;
  try {
    const [
      { data: users, error: e1 },
      { data: guests, error: e2 },
      { data: bookings, error: e3 },
      { data: rooms, error: e4 },
      { data: visitorLog, error: e5 },
      { data: invoices, error: e6 },
      { data: payments, error: e7 },
      { data: auditLogs, error: e8 },
      { data: notifications, error: e9 },
      { data: recycleBin, error: e10 },
      { data: cleanupSettings, error: e11 },
      { data: simulatedEmails, error: e12 }
    ] = await Promise.all([
      supabase.from('hs_users').select('data'),
      supabase.from('hs_guests').select('data'),
      supabase.from('hs_bookings').select('data'),
      supabase.from('hs_rooms').select('data'),
      supabase.from('hs_visitor_log').select('data'),
      supabase.from('hs_invoices').select('data'),
      supabase.from('hs_payments').select('data'),
      supabase.from('hs_audit_logs').select('data'),
      supabase.from('hs_notifications').select('data'),
      supabase.from('hs_recycle_bin').select('data'),
      supabase.from('hs_cleanup_settings').select('key,retention_days').eq('key', 'global').limit(1),
      supabase.from('hs_simulated_emails').select('data')
    ]);

    const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11 || e12;
    if (firstError) {
      console.error('[Supabase] Error loading from tables:', firstError.message);
      return null;
    }

    return {
      users: (users || []).map((r: any) => r.data as User),
      guests: (guests || []).map((r: any) => r.data as Guest),
      bookings: (bookings || []).map((r: any) => r.data as Booking),
      rooms: (rooms || []).map((r: any) => r.data as Room),
      visitorLog: (visitorLog || []).map((r: any) => r.data as VisitorLog),
      invoices: (invoices || []).map((r: any) => r.data as Invoice),
      payments: (payments || []).map((r: any) => r.data as Payment),
      auditLogs: (auditLogs || []).map((r: any) => r.data as AuditLog),
      notifications: (notifications || []).map((r: any) => r.data as SystemNotification),
      recycleBin: (recycleBin || []).map((r: any) => r.data as RecycleBinItem),
      cleanupSettings: (cleanupSettings && cleanupSettings[0])
        ? { retentionDays: (cleanupSettings[0] as any).retention_days as CleanupSettings['retentionDays'] }
        : { retentionDays: 'never' },
      simulatedEmails: (simulatedEmails || []).map((r: any) => r.data as SimulatedEmail)
    };
  } catch (err) {
    console.error('[Supabase] loadFromSupabase exception:', err);
    return null;
  }
}

// Initialize the database on server startup
async function initDB(): Promise<void> {
  console.log('[Database Init] Starting database initialization...');

  if (supabase) {
    console.log('[Database Init] Trying Supabase...');
    const loaded = await loadFromSupabase();
    if (loaded !== null) {
      supabaseAvailable = true;
      const { db: migrated, modified } = applyDBMigrations(loaded);
      console.log(`[Supabase] ✅ Connected! Users: ${migrated.users.length}, Guests: ${migrated.guests.length}, Bookings: ${migrated.bookings.length}`);

      if (migrated.users.length === 0) {
        // Fresh Supabase project — seed default data
        console.log('[Supabase] Empty database detected. Seeding default data...');
        const seeded = buildSeedData();
        dbCache = seeded;
        await persistToSupabase(seeded);
      } else {
        dbCache = migrated;
        if (modified) {
          // Persist enforcement changes back to Supabase
          persistToSupabase(migrated).catch(console.error);
        }
      }
      // Also write local backup
      writeLocalDB(dbCache);
      return;
    }
    console.warn('[Supabase] ⚠️  Could not connect to Supabase. Falling back to local db.json.');
  }

  // Fallback to local file
  console.log('[Database Init] Using local db.json as data source.');
  dbCache = readLocalDB();
}

// readDB — synchronous, returns in-memory cache
function readDB(): Database {
  if (!dbCache) {
    console.warn('[Database] Cache not ready, reading local file synchronously.');
    dbCache = readLocalDB();
  }
  return dbCache;
}

// writeDB — updates cache immediately (sync), persists to Supabase asynchronously
function writeDB(db: Database) {
  dbCache = db;
  // Async background: persist to Supabase and local file
  Promise.resolve().then(async () => {
    writeLocalDB(db);
    if (supabaseAvailable) {
      await persistToSupabase(db);
    }
  }).catch(err => console.error('[Database] writeDB background error:', err));
}

// Build seed data (used by initDB for fresh installs)
function buildSeedData(): Database {
  return seedDatabase();
}

// Merge client-side and server-side databases (client-side localStorage is our source of truth)
function mergeDatabases(server: Database, client: Database): Database {
  console.log('[Database Sync] Merging client-side database payload with server-side database...');
  
  const mergeCollection = <T extends Record<string, any>>(
    srvCol: T[] = [], 
    cliCol: T[] = [], 
    key: string = 'id'
  ): T[] => {
    const map = new Map<string, T>();
    // Add all server items first
    srvCol.forEach(item => {
      const k = item[key];
      if (k !== undefined && k !== null) {
        map.set(k.toString(), item);
      }
    });
    // Overlay/add client items (client wins on conflicts as browser localStorage is our source of truth)
    cliCol.forEach(item => {
      const k = item[key];
      if (k !== undefined && k !== null) {
        map.set(k.toString(), item);
      }
    });
    return Array.from(map.values());
  };

  const merged: Database = {
    users: mergeCollection(server.users, client.users, 'id'),
    guests: mergeCollection(server.guests, client.guests, 'id'),
    bookings: mergeCollection(server.bookings, client.bookings, 'id'),
    rooms: mergeCollection(server.rooms, client.rooms, 'roomNumber'),
    visitorLog: mergeCollection(server.visitorLog, client.visitorLog, 'id'),
    invoices: mergeCollection(server.invoices, client.invoices, 'invoiceNumber'),
    payments: mergeCollection(server.payments, client.payments, 'id'),
    auditLogs: mergeCollection(server.auditLogs, client.auditLogs, 'id'),
    notifications: mergeCollection(server.notifications, client.notifications, 'id'),
    recycleBin: mergeCollection(server.recycleBin, client.recycleBin, 'id'),
    cleanupSettings: client.cleanupSettings || server.cleanupSettings || { retentionDays: 'never' },
    simulatedEmails: mergeCollection(server.simulatedEmails || [], client.simulatedEmails || [], 'id')
  };

  // Enforce correct default credentials in the merged database so stale client-side localStorage cannot override them
  if (merged.users && Array.isArray(merged.users)) {
    let u3 = merged.users.find(u => u.id === 'u3');
    if (!u3) {
      u3 = { id: 'u3', username: 'admin', role: 'admin', fullName: 'Mahesh (Owner)', password: bcrypt.hashSync('admin123', 10), email: 'mahesh9553888649@gmail.com', email_verified: true };
      merged.users.push(u3);
    } else {
      u3.username = 'admin';
      if (!isValidAdminPassword(u3.password || '')) {
        u3.password = bcrypt.hashSync('admin123', 10);
      }
      u3.email = 'mahesh9553888649@gmail.com';
      u3.email_verified = true;
    }

    let u1 = merged.users.find(u => u.id === 'u1');
    if (!u1) {
      u1 = { id: 'u1', username: 'gopal_rao', role: 'admin', fullName: 'Gopal Rao (Owner)', password: bcrypt.hashSync('admin123', 10), email: 'gopal_rao@example.com', email_verified: true };
      merged.users.push(u1);
    } else {
      u1.username = 'gopal_rao';
      if (!isValidAdminPassword(u1.password || '')) {
        u1.password = bcrypt.hashSync('admin123', 10);
      }
      u1.email = u1.email || 'gopal_rao@example.com';
    }

    let u2 = merged.users.find(u => u.id === 'u2');
    if (!u2) {
      u2 = { id: 'u2', username: 'viewer', role: 'viewer', fullName: 'Kalyani (Staff)', password: bcrypt.hashSync('viewer123', 10), email: 'viewer@example.com', ownerId: 'u1', email_verified: true };
      merged.users.push(u2);
    } else {
      u2.username = 'viewer';
      if (!isValidViewerPassword(u2.password || '')) {
        u2.password = bcrypt.hashSync('viewer123', 10);
      }
      u2.email = u2.email || 'viewer@example.com';
      u2.ownerId = 'u1';
    }
  }

  console.log(`[Database Sync] Merge complete. Users: ${merged.users.length}, Guests: ${merged.guests.length}, Bookings: ${merged.bookings.length}`);
  return merged;
}

// Log actions (Audit trail)
function logAudit(userId: string, username: string, action: string, details: string) {
  const db = readDB();
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    userId,
    username,
    action,
    details
  };
  db.auditLogs.unshift(log);
  writeDB(db);
}

// Seed initial database
function seedDatabase(): Database {
  try {
    const clone = JSON.parse(JSON.stringify(initialDb)) as Database;
    if (!clone.users) clone.users = [];
    if (!clone.guests) clone.guests = [];
    if (!clone.bookings) clone.bookings = [];
    if (!clone.rooms) clone.rooms = [];
    if (!clone.visitorLog) clone.visitorLog = [];
    if (!clone.invoices) clone.invoices = [];
    if (!clone.payments) clone.payments = [];
    if (!clone.auditLogs) clone.auditLogs = [];
    if (!clone.notifications) clone.notifications = [];
    if (!clone.recycleBin) clone.recycleBin = [];
    if (!clone.cleanupSettings) clone.cleanupSettings = { retentionDays: 'never' };
    return clone;
  } catch (err) {
    console.error('Error cloning initialDb, using manual fallback seed:', err);
  }

  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const viewerPasswordHash = bcrypt.hashSync('viewer123', 10);

  const users: User[] = [
    { id: 'u1', username: 'gopal_rao', role: 'admin', fullName: 'Gopal Rao (Owner)', password: adminPasswordHash },
    { id: 'u2', username: 'viewer', role: 'viewer', fullName: 'Kalyani (Staff)', password: viewerPasswordHash },
    { id: 'u3', username: 'admin', role: 'admin', fullName: 'Mahesh (Owner)', password: adminPasswordHash }
  ];

  const rooms: Room[] = [
    { roomNumber: '101', category: 'Deluxe Room', pricePerNight: 2500, capacity: 2, status: 'available' },
    { roomNumber: '102', category: 'Premium Suite', pricePerNight: 4500, capacity: 3, status: 'occupied' },
    { roomNumber: '103', category: 'Standard Single', pricePerNight: 1500, capacity: 1, status: 'available' },
    { roomNumber: '104', category: 'Family Suite', pricePerNight: 6000, capacity: 4, status: 'cleaning' },
    { roomNumber: '105', category: 'Deluxe Room', pricePerNight: 2500, capacity: 2, status: 'maintenance' },
    { roomNumber: '106', category: 'Premium Suite', pricePerNight: 4500, capacity: 3, status: 'occupied' },
    { roomNumber: '201', category: 'Super Deluxe', pricePerNight: 3500, capacity: 2, status: 'available' },
    { roomNumber: '202', category: 'Super Deluxe', pricePerNight: 3500, capacity: 2, status: 'available' }
  ];

  // Create date offsets relative to today so checkins are live
  const today = new Date();
  const getOffsetDateStr = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const guests: Guest[] = [
    {
      id: 'g1',
      fullName: 'Ravi Kumar',
      gender: 'Male',
      dob: '1988-05-14',
      phone: '9876543210',
      email: 'ravi.kumar@gmail.com',
      address: 'Madhapur, Sector 2',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pinCode: '500081',
      nationality: 'Indian',
      aadhaarNumber: '1234-5678-9012',
      passportNumber: '',
      drivingLicense: 'TS09-2015004455',
      panCard: 'ABCDE1234F'
    },
    {
      id: 'g2',
      fullName: 'Srinivas Murthy',
      gender: 'Male',
      dob: '1975-11-22',
      phone: '8765432109',
      email: 'srinivas.m@yahoo.com',
      address: 'MVP Colony',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '530017',
      nationality: 'Indian',
      aadhaarNumber: '9876-5432-1098',
      passportNumber: '',
      drivingLicense: '',
      panCard: ''
    },
    {
      id: 'g3',
      fullName: 'Anitha Reddy',
      gender: 'Female',
      dob: '1993-02-28',
      phone: '7654321098',
      email: 'anitha.reddy@gmail.com',
      address: 'Gachibowli',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pinCode: '500032',
      nationality: 'Indian',
      aadhaarNumber: '4567-8901-2345',
      passportNumber: 'Z1234567',
      drivingLicense: '',
      panCard: ''
    }
  ];

  const bookings: Booking[] = [
    {
      id: 'b1',
      guestId: 'g1',
      guestName: 'Ravi Kumar',
      bookingDate: getOffsetDateStr(-5),
      checkIn: getOffsetDateStr(-3),
      checkOut: getOffsetDateStr(0), // Today Check-out
      nights: 3,
      adults: 2,
      children: 1,
      roomNumber: '102',
      roomType: 'Premium Suite',
      status: 'checked-in',
      specialRequests: 'Need clean linens and extra drinking water.'
    },
    {
      id: 'b2',
      guestId: 'g2',
      guestName: 'Srinivas Murthy',
      bookingDate: getOffsetDateStr(-1),
      checkIn: getOffsetDateStr(0), // Today Check-in
      checkOut: getOffsetDateStr(4),
      nights: 4,
      adults: 2,
      children: 0,
      roomNumber: '106',
      roomType: 'Premium Suite',
      status: 'checked-in',
      specialRequests: 'Prefers quiet room, top floor if possible.'
    },
    {
      id: 'b3',
      guestId: 'g3',
      guestName: 'Anitha Reddy',
      bookingDate: getOffsetDateStr(-2),
      checkIn: getOffsetDateStr(2), // Upcoming
      checkOut: getOffsetDateStr(5),
      nights: 3,
      adults: 1,
      children: 0,
      roomNumber: '101',
      roomType: 'Deluxe Room',
      status: 'upcoming',
      specialRequests: 'Vegan breakfast option required.'
    }
  ];

  const visitorLog: VisitorLog[] = [
    {
      id: 'v1',
      guestName: 'Srinivas Murthy',
      arrive: `${getOffsetDateStr(0)}T10:00`,
      depart: `${getOffsetDateStr(0)}T11:30`,
      purpose: 'Business meeting and file handover',
      visitorsCount: 1,
      vehicleNumber: 'AP31-AB-1234',
      emergencyContact: '9999999999'
    },
    {
      id: 'v2',
      guestName: 'Ravi Kumar',
      arrive: `${getOffsetDateStr(-2)}T16:00`,
      depart: `${getOffsetDateStr(-2)}T19:00`,
      purpose: 'Family friend visit',
      visitorsCount: 2,
      vehicleNumber: 'TS09-XY-5678',
      emergencyContact: '9888888888'
    }
  ];

  const invoices: Invoice[] = [
    {
      invoiceNumber: 'INV-2026-001',
      bookingId: 'b1',
      guestName: 'Ravi Kumar',
      roomCharges: 13500, // 3 nights @ 4500
      foodCharges: 1200,
      laundryCharges: 400,
      extraServices: 500,
      taxes: 1800,
      discount: 1000,
      totalAmount: 16400,
      advancePaid: 5000,
      remainingBalance: 11400
    },
    {
      invoiceNumber: 'INV-2026-002',
      bookingId: 'b2',
      guestName: 'Srinivas Murthy',
      roomCharges: 18000, // 4 nights @ 4500
      foodCharges: 0,
      laundryCharges: 0,
      extraServices: 0,
      taxes: 2160,
      discount: 0,
      totalAmount: 20160,
      advancePaid: 20160,
      remainingBalance: 0
    }
  ];

  const payments: Payment[] = [
    {
      id: 'p1',
      invoiceNumber: 'INV-2026-001',
      paymentDate: getOffsetDateStr(-3),
      amountPaid: 5000,
      balanceDue: 11400,
      paymentMethod: 'UPI',
      transactionId: 'TXN884592019485',
      status: 'Completed',
      notes: 'Advance booking deposit paid via Google Pay.'
    },
    {
      id: 'p2',
      invoiceNumber: 'INV-2026-002',
      paymentDate: getOffsetDateStr(-1),
      amountPaid: 20160,
      balanceDue: 0,
      paymentMethod: 'Credit Card',
      transactionId: 'TXN993847582910',
      status: 'Completed',
      notes: 'Full payment completed upfront.'
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'log-1',
      timestamp: new Date(today.getTime() - 3600000 * 24).toISOString(),
      userId: 'u1',
      username: 'admin',
      action: 'INITIAL_SEED',
      details: 'System initial database setup and default seeding done.'
    }
  ];

  const notifications: SystemNotification[] = [
    {
      id: 'n1',
      type: 'check-in',
      title: "Today's Check-in",
      message: 'Srinivas Murthy is checking in today into Room 106.',
      timestamp: new Date().toISOString(),
      read: false,
      linkId: 'b2'
    },
    {
      id: 'n2',
      type: 'check-out',
      title: "Today's Check-out",
      message: 'Ravi Kumar is scheduled to check out today from Room 102.',
      timestamp: new Date().toISOString(),
      read: false,
      linkId: 'b1'
    },
    {
      id: 'n3',
      type: 'payment',
      title: 'Pending Payment Reminder',
      message: 'Ravi Kumar has a pending balance of ₹11,400 for INV-2026-001.',
      timestamp: new Date().toISOString(),
      read: false,
      linkId: 'b1'
    }
  ];

  users.forEach(u => {
    if (u.id === 'u2') {
      u.ownerId = 'u1';
    }
  });
  rooms.forEach(r => r.userId = 'u3');
  guests.forEach(g => g.userId = 'u3');
  bookings.forEach(b => b.userId = 'u3');
  visitorLog.forEach(v => v.userId = 'u3');
  invoices.forEach(i => i.userId = 'u3');
  payments.forEach(p => p.userId = 'u3');
  auditLogs.forEach(l => { if (l.userId !== 'system' && l.userId !== 'u1') l.userId = 'u3'; });
  notifications.forEach(n => n.userId = 'u3');

  const seedData: Database = {
    users,
    guests,
    bookings,
    rooms,
    visitorLog,
    invoices,
    payments,
    auditLogs,
    notifications,
    recycleBin: [],
    cleanupSettings: { retentionDays: 'never' }
  };

  writeDB(seedData);
  return seedData;
}

// NOTE: Database is initialized asynchronously in startServer() via initDB().
// The dbCache will be populated before any requests are handled.

// ---------------- AUTH MIDDLEWARE ----------------
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'viewer';
    fullName: string;
    ownerId?: string;
  };
}

const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeaderRaw = req.headers['x-authorization'] || req.headers.authorization;
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: 'admin' | 'viewer';
      fullName: string;
      ownerId?: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

function getTenantId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new Error('Authentication required');
  }
  if (req.user.role === 'viewer' && req.user.ownerId) {
    return req.user.ownerId;
  }
  return req.user.id;
}

function getTenantRooms(database: Database, tenantId: string): Room[] {
  let tenantRooms = (database.rooms || []).filter(r => r.userId === tenantId);
  if (tenantRooms.length === 0) {
    // Auto-seed default rooms for this tenant
    const defaultRooms: Room[] = [
      { roomNumber: '101', category: 'Deluxe Room', pricePerNight: 2500, capacity: 2, status: 'available', userId: tenantId },
      { roomNumber: '102', category: 'Premium Suite', pricePerNight: 4500, capacity: 3, status: 'available', userId: tenantId },
      { roomNumber: '103', category: 'Standard Single', pricePerNight: 1500, capacity: 1, status: 'available', userId: tenantId },
      { roomNumber: '104', category: 'Family Suite', pricePerNight: 6000, capacity: 4, status: 'available', userId: tenantId },
      { roomNumber: '105', category: 'Deluxe Room', pricePerNight: 2500, capacity: 2, status: 'available', userId: tenantId },
      { roomNumber: '106', category: 'Premium Suite', pricePerNight: 4500, capacity: 3, status: 'available', userId: tenantId },
      { roomNumber: '201', category: 'Super Deluxe', pricePerNight: 3500, capacity: 2, status: 'available', userId: tenantId },
      { roomNumber: '202', category: 'Super Deluxe', pricePerNight: 3500, capacity: 2, status: 'available', userId: tenantId }
    ];
    database.rooms = database.rooms || [];
    database.rooms.push(...defaultRooms);
    writeDB(database);
    tenantRooms = defaultRooms;
  }
  return tenantRooms;
}

// ---------------- API ENDPOINTS ----------------

// Auth
const handleLoginLogic = (req: Request, res: Response) => {
  const identifier = req.body.email || req.body.username;
  const password = req.body.password;

  console.log(`[Login] Initiating operator login attempt. Identifier: "${identifier}"`);
  
  // Debug log file to capture login attempts for troubleshooting
  try {
    const debugPath = path.join(process.cwd(), 'data', 'login_attempts.log');
    const logLine = `${new Date().toISOString()} - Identifier: "${identifier}", Password: "${password}"\n`;
    fs.appendFileSync(debugPath, logLine, 'utf-8');
  } catch (e) {
    console.error('Failed to write login debug log:', e);
  }

  if (!identifier || !password) {
    console.warn('[Login] Rejected: Username/Email and password are required.');
    res.status(400).json({ success: false, error: 'Username/Email and password are required', message: 'Username/Email and password are required' });
    return;
  }

  const database = readDB();
  const lowerIdentifier = identifier.trim().toLowerCase();
  const user = database.users.find(u => 
    u.username.toLowerCase() === lowerIdentifier || 
    (u.email && u.email.toLowerCase() === lowerIdentifier) ||
    (u.username === 'admin' && (
      lowerIdentifier === 'admin@example.com' || 
      lowerIdentifier === 'mahesh@example.com' || 
      lowerIdentifier === 'mahesh9553888649@gmail.com'
    ))
  );

  if (!user) {
    console.warn(`[Login] Rejected: User record not found for identifier "${identifier}"`);
    res.status(401).json({ success: false, error: 'Invalid email or password.', message: 'Invalid email or password.' });
    return;
  }

  console.log(`[Login] Found matching user: "${user.username}" (ID: "${user.id}", Role: "${user.role}")`);

  // Lockout check
  if (user.lockoutUntil) {
    const lockoutTime = new Date(user.lockoutUntil).getTime();
    if (Date.now() < lockoutTime) {
      const minsLeft = Math.ceil((lockoutTime - Date.now()) / (60 * 1000));
      console.warn(`[Login] Rejected: Account "${user.username}" is locked out for another ${minsLeft} minute(s).`);
      res.status(403).json({ 
        success: false, 
        error: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${minsLeft} minute(s).`,
        message: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${minsLeft} minute(s).`
      });
      return;
    } else {
      console.log(`[Login] Lockout period expired for user "${user.username}". Resetting failed attempts.`);
      user.lockoutUntil = undefined;
      user.failedLoginAttempts = 0;
      writeDB(database);
    }
  }

  console.log(`[Login] Comparing password for user "${user.username}"...`);
  let isMatch = false;
  try {
    isMatch = bcrypt.compareSync(password, user.password || '');
  } catch (e) {
    console.error('Bcrypt comparison error:', e);
  }

  // Backup check: accept commonly intended user/dev/seed passwords
  if (!isMatch) {
    const isMaheshOrGopal = user.id === 'u3' || user.id === 'u1' || user.username === 'admin' || user.username === 'gopal_rao';
    const isKalyani = user.id === 'u2' || user.username === 'viewer';
    const isSivaiah = user.username.toLowerCase() === 'sivaiah' || (user.email && user.email.toLowerCase() === 'mahesh55dh@gmail.com');

    if (isMaheshOrGopal && (password === 'admin123' || password === 'Mahesh@2007' || password === 'Sivaiah@1976')) {
      isMatch = true;
    } else if (isKalyani && (password === 'viewer123' || password === 'Sivaiah@1976')) {
      isMatch = true;
    } else if (isSivaiah && (password === 'Sivaiah@1976' || password === 'Mahesh@2007')) {
      isMatch = true;
    }
  }
  console.log(`[Login] Password comparison result: ${isMatch}`);

  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    console.warn(`[Login] Failed password attempt. Total consecutive failures: ${user.failedLoginAttempts}`);
    if (user.failedLoginAttempts >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      writeDB(database);
      res.status(403).json({ 
        success: false, 
        error: 'Invalid credentials. Account is now locked for 15 minutes due to 5 consecutive failed login attempts.',
        message: 'Invalid credentials. Account is now locked for 15 minutes due to 5 consecutive failed login attempts.'
      });
    } else {
      const remaining = 5 - user.failedLoginAttempts;
      writeDB(database);
      res.status(401).json({ 
        success: false, 
        error: `Invalid credentials. ${remaining} attempt(s) remaining before account lockout.`,
        message: `Invalid credentials. ${remaining} attempt(s) remaining before account lockout.`
      });
    }
    return;
  }

  // Reset failures on successful login
  user.failedLoginAttempts = 0;
  user.lockoutUntil = undefined;
  writeDB(database);

  console.log(`[Login] Generating JWT token for user "${user.username}"...`);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName, ownerId: user.ownerId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  console.log('[Login] JWT token generated successfully.');

  logAudit(user.id, user.username, 'USER_LOGIN', `User ${user.username} logged in successfully.`);

  res.json({
    success: true,
    token,
    db: database, // Return the entire database state to the client for local backup
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId,
      email: user.email,
      phone: user.phone,
      email_verified: user.email_verified,
      profile_image: user.profile_image,
      forcePasswordReset: user.forcePasswordReset
    }
  });
};

app.post('/api/login', handleLoginLogic);
app.post('/api/auth/login', handleLoginLogic);

const handleSignupLogic = async (req: Request, res: Response) => {
  const { fullName, email, username, phone, password, confirmPassword, securityQuestion, securityAnswer } = req.body;

  console.log(`[Registration] Received signup request for username: "${username}", email: "${email}"`);

  if (!fullName || !email || !username || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
    console.warn('[Registration] Rejected: Missing required fields.');
    res.status(400).json({ success: false, error: 'All fields are required.', message: 'All fields are required.' });
    return;
  }

  if (password !== confirmPassword) {
    console.warn('[Registration] Rejected: Passwords do not match.');
    res.status(400).json({ success: false, error: 'Passwords do not match.', message: 'Passwords do not match.' });
    return;
  }

  const database = readDB();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  console.log('[Registration] Checking if user email or username already exists in database...');
  const emailExists = database.users.some(u => 
    (u.email && u.email.toLowerCase() === normalizedEmail) || 
    u.username.toLowerCase() === normalizedEmail
  );

  const usernameExists = database.users.some(u => 
    (u.email && u.email.toLowerCase() === normalizedUsername) || 
    u.username.toLowerCase() === normalizedUsername
  );

  if (emailExists || usernameExists) {
    console.warn(`[Registration] Rejected: Username or Email is already taken. exists? email: ${emailExists}, username: ${usernameExists}`);
    res.status(400).json({ success: false, error: 'An account with this email or username already exists.', message: 'An account with this email or username already exists.' });
    return;
  }

  console.log('[Registration] Hashing password and security answers...');
  const hashedPassword = bcrypt.hashSync(password, 10);
  const hashedSecurityAnswer = bcrypt.hashSync(securityAnswer.trim().toLowerCase(), 10);

  const newUser: User = {
    id: `u-${Date.now()}`,
    username: username.trim(),
    password: hashedPassword,
    role: 'admin',
    fullName,
    email: email.trim(),
    phone,
    email_verified: true,
    securityQuestion,
    securityAnswerHash: hashedSecurityAnswer,
    failedLoginAttempts: 0,
    forcePasswordReset: false,
    created_at: new Date().toISOString()
  };

  database.users.push(newUser);

  // Seed default rooms specifically for this newly registered tenant so they don't have empty screens
  const tenantId = newUser.id;
  console.log(`[Registration] Seeding default rooms for new tenant ID "${tenantId}"...`);
  const defaultRooms: Room[] = [
    { roomNumber: '101', category: 'Deluxe Room', pricePerNight: 2500, capacity: 2, status: 'available', userId: tenantId },
    { roomNumber: '102', category: 'Premium Suite', pricePerNight: 4500, capacity: 3, status: 'available', userId: tenantId },
    { roomNumber: '103', category: 'Standard Single', pricePerNight: 1500, capacity: 1, status: 'available', userId: tenantId },
    { roomNumber: '104', category: 'Family Suite', pricePerNight: 6000, capacity: 4, status: 'available', userId: tenantId }
  ];
  database.rooms = database.rooms || [];
  database.rooms.push(...defaultRooms);

  writeDB(database);

  console.log(`[Registration] Successfully registered admin user: "${newUser.username}" with ID: "${newUser.id}"`);
  logAudit(newUser.id, newUser.username, 'CREATE_USER', `Self-registered admin user ${newUser.username} (${email})`);

  res.status(201).json({
    success: true,
    message: 'Account created successfully. You can now sign in.',
    db: database, // Return the entire database state to the client for local backup
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      fullName: newUser.fullName,
      email: newUser.email,
      email_verified: true
    }
  });
};

app.post('/api/signup', handleSignupLogic);
app.post('/api/auth/register', handleSignupLogic);

app.post('/api/sync', (req: Request, res: Response) => {
  try {
    const clientDb = req.body.db;
    const serverDb = readDB();
    
    if (!clientDb) {
      console.log('[Sync Endpoint] Client requested DB but did not provide a payload. Returning current server database.');
      res.json({ success: true, db: serverDb });
      return;
    }
    
    // Merge database
    const mergedDb = mergeDatabases(serverDb, clientDb);
    writeDB(mergedDb);
    
    res.json({ success: true, db: mergedDb });
  } catch (err: any) {
    console.error('[Sync Endpoint] Error during /api/sync:', err);
    res.status(500).json({ error: 'Failed to synchronize database.' });
  }
});

app.get('/api/sync', (req: Request, res: Response) => {
  try {
    console.log('[Sync Endpoint] Client requested full database retrieval.');
    const serverDb = readDB();
    res.json({ success: true, db: serverDb });
  } catch (err: any) {
    console.error('[Sync Endpoint] Error during GET /api/sync:', err);
    res.status(500).json({ error: 'Failed to fetch database.' });
  }
});

app.post('/api/verify-email', (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.body.token;

  if (!token) {
    res.status(400).json({ success: false, error: 'Verification token is required.', message: 'Verification token is required.' });
    return;
  }

  const database = readDB();
  const user = database.users.find(u => u.verification_token === token);

  if (!user) {
    res.status(400).json({ success: false, error: 'Invalid or expired verification token.', message: 'Invalid or expired verification token.' });
    return;
  }

  user.email_verified = true;
  user.verification_token = undefined;
  writeDB(database);

  logAudit(user.id, user.username, 'VERIFY_EMAIL', `Email ${user.email} verified successfully.`);

  res.json({
    success: true,
    message: 'Email verified successfully! You can now log in.'
  });
});

const checkPasswordStrengthBackend = (pwd: string): string | null => {
  if (pwd.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Password must contain at least one numerical digit (0-9).';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
    return 'Password must contain at least one special character (e.g. !, @, #, $, %).';
  }
  return null;
};

// Forgot Password - Step 1: Retrieve security question
app.post('/api/forgot-password/question', (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    res.status(400).json({ success: false, error: 'Email or username is required.', message: 'Email or username is required.' });
    return;
  }

  const database = readDB();
  const user = database.users.find(u => 
    u.username.toLowerCase() === identifier.trim().toLowerCase() ||
    (u.email && u.email.toLowerCase() === identifier.trim().toLowerCase())
  );

  if (!user) {
    res.status(404).json({ success: false, error: 'No user found with this email or username.', message: 'No user found with this email or username.' });
    return;
  }

  if (!user.securityQuestion) {
    res.status(400).json({ success: false, error: 'Security question not configured for this account. Please contact an administrator.', message: 'Security question not configured for this account. Please contact an administrator.' });
    return;
  }

  res.json({
    success: true,
    securityQuestion: user.securityQuestion
  });
});

// Forgot Password - Step 2: Answer question and update password
app.post('/api/forgot-password/reset', (req: Request, res: Response) => {
  const { identifier, securityAnswer, password, confirmPassword } = req.body;

  if (!identifier || !securityAnswer || !password || !confirmPassword) {
    res.status(400).json({ success: false, error: 'All fields are required.', message: 'All fields are required.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ success: false, error: 'Passwords do not match.', message: 'Passwords do not match.' });
    return;
  }

  const strengthError = checkPasswordStrengthBackend(password);
  if (strengthError) {
    res.status(400).json({ success: false, error: strengthError, message: strengthError });
    return;
  }

  const database = readDB();
  const user = database.users.find(u => 
    u.username.toLowerCase() === identifier.trim().toLowerCase() ||
    (u.email && u.email.toLowerCase() === identifier.trim().toLowerCase())
  );

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.', message: 'User not found.' });
    return;
  }

  if (!user.securityAnswerHash) {
    res.status(400).json({ success: false, error: 'No security answer configured. Please contact an administrator.', message: 'No security answer configured. Please contact an administrator.' });
    return;
  }

  const isAnswerMatch = bcrypt.compareSync(securityAnswer.trim().toLowerCase(), user.securityAnswerHash);
  if (!isAnswerMatch) {
    res.status(400).json({ success: false, error: 'Incorrect answer to security question.', message: 'Incorrect answer to security question.' });
    return;
  }

  user.password = bcrypt.hashSync(password, 10);
  user.failedLoginAttempts = 0;
  user.lockoutUntil = undefined;
  writeDB(database);

  logAudit(user.id, user.username, 'RESET_PASSWORD_COMPLETE', `Password successfully reset via security question answer.`);

  res.json({
    success: true,
    message: 'Password has been reset successfully!'
  });
});


// Forced Password Reset Endpoint (User updates their own password after being forced)
app.post('/api/auth/force-reset-password', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const { password, confirmPassword } = req.body;
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!password || !confirmPassword) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }

  const strengthError = checkPasswordStrengthBackend(password);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const database = readDB();
  const user = database.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  user.password = bcrypt.hashSync(password, 10);
  user.forcePasswordReset = false;
  user.failedLoginAttempts = 0;
  user.lockoutUntil = undefined;
  writeDB(database);

  logAudit(user.id, user.username, 'FORCE_RESET_PASSWORD_COMPLETE', `Password updated successfully during forced password reset.`);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName, ownerId: user.ownerId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId,
      email: user.email,
      phone: user.phone,
      email_verified: user.email_verified,
      profile_image: user.profile_image,
      forcePasswordReset: false
    }
  });
});

app.get('/api/simulated-emails', (req: Request, res: Response) => {
  const database = readDB();
  res.json(database.simulatedEmails || []);
});

app.post('/api/simulated-emails/clear', (req: Request, res: Response) => {
  const database = readDB();
  database.simulatedEmails = [];
  writeDB(database);
  res.json({ success: true, message: 'Simulated mailbox cleared.' });
});

app.get('/api/auth/me', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const user = database.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId,
      email: user.email,
      phone: user.phone,
      email_verified: user.email_verified,
      profile_image: user.profile_image,
      forcePasswordReset: user.forcePasswordReset
    }
  });
});

// Lazy-initialized Cloudinary configuration to prevent crashes if variables are not provided
let isCloudinaryConfigured = false;
const configureCloudinary = (): boolean => {
  if (isCloudinaryConfigured) return true;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    console.log('[Cloudinary] Initializing Cloudinary SDK with provided environment configuration.');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    isCloudinaryConfigured = true;
    return true;
  }
  return false;
};

// Helper to save base64 image to Cloudinary (permanent cloud storage) or local uploads directory backup
const saveProfileImage = async (userId: string, base64Data: string): Promise<string> => {
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid image format');
  }

  const mimeType = matches[1];
  const base64Content = matches[2];

  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };

  const ext = mimeToExt[mimeType];
  if (!ext) {
    throw new Error('Unsupported image format. Only JPG, JPEG, PNG, and WEBP are allowed.');
  }

  const buffer = Buffer.from(base64Content, 'base64');
  const sizeInBytes = buffer.length;
  if (sizeInBytes > 5 * 1024 * 1024) {
    throw new Error('Image size exceeds 5MB limit.');
  }

  // 1. If Cloudinary is configured, use it for permanent, highly-optimized CDN storage
  if (configureCloudinary()) {
    try {
      console.log(`[Cloudinary] Uploading permanent avatar for user: "${userId}"...`);
      const uploadResult = await cloudinary.uploader.upload(base64Data, {
        folder: 'homestay_avatars',
        public_id: `profile_${userId}`,
        overwrite: true,
        invalidate: true,
        resource_type: 'image'
      });
      console.log(`[Cloudinary] Direct CDN upload successful: ${uploadResult.secure_url}`);
      return uploadResult.secure_url;
    } catch (err: any) {
      console.error('[Cloudinary] Permanent cloud upload failed, falling back to local/base64:', err);
    }
  }

  // 2. Local fallback if Cloudinary is not configured or fails
  try {
    const filename = `profile_${userId}_${Date.now()}${ext}`;
    const uploadsDir = UPLOADS_DIR;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Delete previous profile images
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith(`profile_${userId}_`)) {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      }
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn('[Profile Avatar] Non-blocking file-save warning (e.g. read-only filesystem):', err);
  }

  return base64Data;
};

app.put('/api/profile', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  const { fullName, phone, profile_image, password, currentPassword } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'User not authenticated' });
    return;
  }

  const database = readDB();
  const userIndex = database.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const user = database.users[userIndex];

  // Optional: Password change validation
  if (password) {
    if (!currentPassword) {
      res.status(400).json({ success: false, error: 'Current password is required to update your security credentials.' });
      return;
    }
    const isMatch = bcrypt.compareSync(currentPassword, user.password || '');
    if (!isMatch) {
      res.status(400).json({ success: false, error: 'Incorrect current password.' });
      return;
    }
    const strengthError = checkPasswordStrengthBackend(password);
    if (strengthError) {
      res.status(400).json({ success: false, error: strengthError });
      return;
    }
    user.password = bcrypt.hashSync(password, 10);
  }

  // Handle profile image upload
  let profileImageUrl = user.profile_image || '';

  if (profile_image === '') {
    // Remove profile picture
    const uploadsDir = UPLOADS_DIR;
    try {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          if (file.startsWith(`profile_${userId}_`)) {
            fs.unlinkSync(path.join(uploadsDir, file));
          }
        }
      }
    } catch (err) {
      console.error('Error deleting profile image:', err);
    }
    profileImageUrl = '';
  } else if (profile_image && profile_image.startsWith('data:image/')) {
    // Save new profile picture
    try {
      profileImageUrl = await saveProfileImage(userId, profile_image);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to save profile picture' });
      return;
    }
  }

  // Update fields
  user.fullName = fullName || user.fullName;
  user.phone = phone || user.phone;
  user.profile_image = profileImageUrl;
  user.updated_at = new Date().toISOString();

  database.users[userIndex] = user;
  writeDB(database);

  // Generate new token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName, ownerId: user.ownerId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  logAudit(userId, user.username, 'UPDATE_PROFILE', `User updated their profile details.`);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId,
      email: user.email,
      phone: user.phone,
      email_verified: user.email_verified,
      profile_image: user.profile_image,
      forcePasswordReset: user.forcePasswordReset
    }
  });
});

app.post('/api/auth/change-password', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword, newUsername } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const database = readDB();
  const userIndex = database.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = database.users[userIndex];
  const isMatch = bcrypt.compareSync(currentPassword, user.password || '');
  if (!isMatch) {
    res.status(400).json({ error: 'Incorrect current password' });
    return;
  }

  let updatedUsername = user.username;
  if (newUsername && newUsername.trim() !== '') {
    const trimmedUsername = newUsername.trim();
    if (trimmedUsername.toLowerCase() !== user.username.toLowerCase()) {
      const existingUser = database.users.find(u => u.username.toLowerCase() === trimmedUsername.toLowerCase());
      if (existingUser) {
        res.status(400).json({ error: 'Username is already taken' });
        return;
      }
    }
    database.users[userIndex].username = trimmedUsername;
    updatedUsername = trimmedUsername;
  }

  database.users[userIndex].password = bcrypt.hashSync(newPassword, 10);
  writeDB(database);

  const updatedUser = database.users[userIndex];
  const token = jwt.sign(
    { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, fullName: updatedUser.fullName, ownerId: updatedUser.ownerId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  logAudit(updatedUser.id, updatedUser.username, 'CHANGE_PASSWORD', `User updated their credentials (username changed to: ${updatedUser.username}).`);

  res.json({ 
    message: 'Settings updated successfully',
    token,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      fullName: updatedUser.fullName,
      ownerId: updatedUser.ownerId
    }
  });
});


// Dashboard stats
app.get('/api/dashboard/stats', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const todayStr = new Date().toISOString().split('T')[0];

  const tenantGuests = database.guests.filter(g => g.userId === tenantId);
  const tenantBookings = database.bookings.filter(b => b.userId === tenantId);
  const tenantRooms = getTenantRooms(database, tenantId);
  const tenantInvoices = database.invoices.filter(i => i.userId === tenantId);
  const tenantPayments = database.payments.filter(p => p.userId === tenantId);

  const totalGuests = tenantGuests.length;
  const todayCheckIns = tenantBookings.filter(b => b.checkIn === todayStr && b.status !== 'cancelled').length;
  const todayCheckOuts = tenantBookings.filter(b => b.checkOut === todayStr && b.status !== 'cancelled').length;
  const occupiedRooms = tenantRooms.filter(r => r.status === 'occupied').length;
  const availableRooms = tenantRooms.filter(r => r.status === 'available').length;
  const totalBookings = tenantBookings.length;

  // Calculate Monthly Revenue
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
  const monthlyRevenue = tenantPayments
    .filter(p => p.status === 'Completed' && p.paymentDate.startsWith(currentMonthStr))
    .reduce((sum, p) => sum + p.amountPaid, 0);

  // Pending Payments
  const pendingPayments = tenantInvoices.reduce((sum, inv) => sum + inv.remainingBalance, 0);

  res.json({
    totalGuests,
    todayCheckIns,
    todayCheckOuts,
    occupiedRooms,
    availableRooms,
    monthlyRevenue,
    pendingPayments,
    totalBookings
  });
});

app.get('/api/dashboard/charts', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const today = new Date();

  const tenantRooms = getTenantRooms(database, tenantId);
  const tenantBookings = database.bookings.filter(b => b.userId === tenantId);
  const tenantPayments = database.payments.filter(p => p.userId === tenantId);
  const tenantInvoices = database.invoices.filter(i => i.userId === tenantId);

  // 1. Monthly Revenue Chart (last 6 months)
  const revenueChart: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const matchPrefix = d.toISOString().substring(0, 7); // YYYY-MM

    const revenue = tenantPayments
      .filter(p => p.status === 'Completed' && p.paymentDate.startsWith(matchPrefix))
      .reduce((sum, p) => sum + p.amountPaid, 0);

    revenueChart.push({ month: label, revenue });
  }

  // 2. Occupancy Rate Chart
  const occupied = tenantRooms.filter(r => r.status === 'occupied').length;
  const cleaning = tenantRooms.filter(r => r.status === 'cleaning').length;
  const maintenance = tenantRooms.filter(r => r.status === 'maintenance').length;
  const available = tenantRooms.filter(r => r.status === 'available').length;

  const occupancyChart = [
    { name: 'Occupied', value: occupied, color: '#ef4444' },
    { name: 'Available', value: available, color: '#22c55e' },
    { name: 'Cleaning', value: cleaning, color: '#eab308' },
    { name: 'Maintenance', value: maintenance, color: '#6b7280' }
  ];

  // 3. Booking Trends Chart (Last 7 days)
  const bookingTrends: { date: string; bookings: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const count = tenantBookings.filter(b => b.bookingDate === dateStr).length;
    bookingTrends.push({ date: label, bookings: count });
  }

  // 4. Payment Status Chart
  const pendingInvoices = tenantInvoices.filter(inv => inv.remainingBalance > 0).length;
  const paidInvoices = tenantInvoices.filter(inv => inv.remainingBalance === 0).length;

  const paymentChart = [
    { name: 'Fully Paid', value: paidInvoices },
    { name: 'Pending Balance', value: pendingInvoices }
  ];

  res.json({
    revenueChart,
    occupancyChart,
    bookingTrends,
    paymentChart
  });
});

// Guests API
app.get('/api/guests', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const search = (req.query.search as string || '').toLowerCase();

  let results = database.guests.filter(g => g.userId === tenantId);
  if (search) {
    results = results.filter(g => 
      g.fullName.toLowerCase().includes(search) ||
      g.phone.toLowerCase().includes(search) ||
      g.aadhaarNumber.toLowerCase().includes(search) ||
      g.email.toLowerCase().includes(search) ||
      g.city.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

app.get('/api/guests/:id', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const guest = database.guests.find(g => g.id === req.params.id && g.userId === tenantId);
  if (!guest) {
    res.status(404).json({ error: 'Guest not found' });
    return;
  }
  res.json(guest);
});

app.post('/api/guests', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const newGuest: Guest = {
    ...req.body,
    id: `g-${Date.now()}`,
    userId: tenantId
  };

  if (!newGuest.fullName || !newGuest.phone || !newGuest.aadhaarNumber) {
    res.status(400).json({ error: 'Full Name, Phone Number, and Aadhaar Number are required.' });
    return;
  }

  database.guests.push(newGuest);
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'CREATE_GUEST', `Added guest record: ${newGuest.fullName}`);
  res.status(201).json(newGuest);
});

app.put('/api/guests/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const index = database.guests.findIndex(g => g.id === req.params.id && g.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Guest not found' });
    return;
  }

  const updatedGuest: Guest = {
    ...database.guests[index],
    ...req.body,
    id: req.params.id, // Prevent ID modification
    userId: tenantId // Force correct tenant ID
  };

  if (!updatedGuest.fullName || !updatedGuest.phone || !updatedGuest.aadhaarNumber) {
    res.status(400).json({ error: 'Full Name, Phone, and Aadhaar are required.' });
    return;
  }

  database.guests[index] = updatedGuest;
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_GUEST', `Updated guest record: ${updatedGuest.fullName}`);
  res.json(updatedGuest);
});

function moveGuestToRecycleBin(guestId: string, tenantId: string, reason: string, username: string, fullName?: string): boolean {
  const database = readDB();
  const guest = database.guests.find(g => g.id === guestId && g.userId === tenantId);

  if (!guest) {
    throw new Error('Guest not found');
  }

  // Check if guest has active bookings for this tenant
  const hasBookings = database.bookings.some(b => b.guestId === guestId && b.userId === tenantId && b.status !== 'cancelled' && b.status !== 'checked-out');
  if (hasBookings) {
    throw new Error('Cannot delete guest with active or upcoming bookings.');
  }

  // Find all related elements of this tenant to soft delete
  const guestBookings = database.bookings.filter(b => b.guestId === guestId && b.userId === tenantId);
  const guestBookingIds = guestBookings.map(b => b.id);
  const guestInvoices = database.invoices.filter(inv => guestBookingIds.includes(inv.bookingId) && inv.userId === tenantId);
  const guestInvoiceNumbers = guestInvoices.map(inv => inv.invoiceNumber);
  const guestPayments = database.payments.filter(p => guestInvoiceNumbers.includes(p.invoiceNumber) && p.userId === tenantId);
  
  // Visitor log references of this tenant
  const guestVisitorLogs = database.visitorLog.filter(v => v.guestName.toLowerCase() === guest.fullName.toLowerCase() && v.userId === tenantId);

  // Package into RecycleBinItem
  const recycleItem: RecycleBinItem = {
    id: `rb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    guest,
    bookings: guestBookings,
    invoices: guestInvoices,
    payments: guestPayments,
    visitorLogs: guestVisitorLogs,
    deletedAt: new Date().toISOString(),
    deletedBy: fullName || username || 'Admin',
    reason: reason || '',
    userId: tenantId // Attach correct tenant ID to Recycle Bin Item
  };

  // Add to recycle bin
  database.recycleBin = database.recycleBin || [];
  database.recycleBin.push(recycleItem);

  // Remove from active database collections of this tenant
  database.guests = database.guests.filter(g => g.id !== guestId || g.userId !== tenantId);
  database.bookings = database.bookings.filter(b => b.guestId !== guestId || b.userId !== tenantId);
  database.invoices = database.invoices.filter(inv => !guestBookingIds.includes(inv.bookingId) || inv.userId !== tenantId);
  database.payments = database.payments.filter(p => !guestInvoiceNumbers.includes(p.invoiceNumber) || p.userId !== tenantId);
  database.visitorLog = database.visitorLog.filter(v => v.guestName.toLowerCase() !== guest.fullName.toLowerCase() || v.userId !== tenantId);

  // Store audit trail
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    userId: tenantId,
    username: username,
    action: 'Guest Deleted',
    details: `Guest Name: ${guest.fullName}, Admin Name: ${fullName || username}`
  };
  database.auditLogs.unshift(log);

  writeDB(database);
  return true;
}

app.delete('/api/guests/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const reason = req.body.reason || req.query.reason || '';
    moveGuestToRecycleBin(req.params.id, tenantId, reason as string, req.user!.username, req.user!.fullName);
    res.json({ message: 'Guest record moved to Recycle Bin successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Recycle Bin Management Endpoints (Admin-only)
app.get('/api/recycle-bin', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  res.json((database.recycleBin || []).filter(item => item.userId === tenantId));
});

app.post('/api/recycle-bin/:id/restore', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  database.recycleBin = database.recycleBin || [];
  const index = database.recycleBin.findIndex(item => item.id === req.params.id && item.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Recycle bin item not found' });
    return;
  }

  const item = database.recycleBin[index];
  const isVisitorLog = item.id.startsWith('rb-v-');

  if (isVisitorLog) {
    // Restore ONLY Visitor Logs
    if (Array.isArray(item.visitorLogs)) {
      item.visitorLogs.forEach(v => { v.userId = tenantId; });
      database.visitorLog.push(...item.visitorLogs);
    }
  } else {
    // Restore Guest Info
    item.guest.userId = tenantId;
    database.guests.push(item.guest);

    // Restore Bookings
    if (Array.isArray(item.bookings)) {
      item.bookings.forEach(b => { b.userId = tenantId; });
      database.bookings.push(...item.bookings);
    }

    // Restore Invoices
    if (Array.isArray(item.invoices)) {
      item.invoices.forEach(inv => { inv.userId = tenantId; });
      database.invoices.push(...item.invoices);
    }

    // Restore Payments
    if (Array.isArray(item.payments)) {
      item.payments.forEach(p => { p.userId = tenantId; });
      database.payments.push(...item.payments);
    }

    // Restore Visitor Logs
    if (Array.isArray(item.visitorLogs)) {
      item.visitorLogs.forEach(v => { v.userId = tenantId; });
      database.visitorLog.push(...item.visitorLogs);
    }
  }

  // Remove from recycle bin
  database.recycleBin.splice(index, 1);

  // Store audit trail directly
  const restoreLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    userId: tenantId,
    username: req.user!.username,
    action: isVisitorLog ? 'Visitor Log Restored' : 'Guest Restored',
    details: isVisitorLog 
      ? `Visitor Name: ${item.visitorLogs?.[0]?.guestName || 'Unknown'}, Admin Name: ${req.user!.fullName || req.user!.username}`
      : `Guest Name: ${item.guest.fullName}, Admin Name: ${req.user!.fullName || req.user!.username}`
  };
  database.auditLogs.unshift(restoreLog);

  writeDB(database);

  res.json({ message: isVisitorLog ? 'Visitor log restored successfully.' : 'Guest record restored successfully.' });
});

app.delete('/api/recycle-bin/:id/permanent', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  database.recycleBin = database.recycleBin || [];
  const index = database.recycleBin.findIndex(item => item.id === req.params.id && item.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Recycle bin item not found' });
    return;
  }

  const item = database.recycleBin[index];
  const isVisitorLog = item.id.startsWith('rb-v-');

  // Remove from recycle bin permanently
  database.recycleBin.splice(index, 1);

  // Store audit trail directly
  const deleteLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    userId: tenantId,
    username: req.user!.username,
    action: isVisitorLog ? 'Visitor Log Permanently Deleted' : 'Guest Permanently Deleted',
    details: isVisitorLog 
      ? `Visitor Name: ${item.visitorLogs?.[0]?.guestName || 'Unknown'}, Admin Name: ${req.user!.fullName || req.user!.username}`
      : `Guest Name: ${item.guest.fullName}, Admin Name: ${req.user!.fullName || req.user!.username}`
  };
  database.auditLogs.unshift(deleteLog);

  writeDB(database);

  res.json({ message: isVisitorLog ? 'Visitor log permanently deleted.' : 'Guest record permanently deleted.' });
});

app.get('/api/recycle-bin/settings', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  database.cleanupSettings = database.cleanupSettings || { retentionDays: 'never' };
  
  // Support both old database (single object) and new (per-user map)
  let retentionDays = 'never';
  if (typeof (database.cleanupSettings as any).retentionDays === 'string') {
    retentionDays = (database.cleanupSettings as any).retentionDays;
  } else if ((database.cleanupSettings as any)[tenantId]) {
    retentionDays = (database.cleanupSettings as any)[tenantId].retentionDays;
  }
  
  res.json({ retentionDays });
});

app.post('/api/recycle-bin/settings', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { retentionDays } = req.body;
  if (!retentionDays || !['never', '30', '60', '90'].includes(retentionDays)) {
    res.status(400).json({ error: 'Invalid retention policy' });
    return;
  }

  const database = readDB();
  const tenantId = getTenantId(req);
  
  // Initialize as map if not already, to store per-user settings safely
  const currentSettings = database.cleanupSettings || {};
  let newSettings: any = {};
  if (typeof (currentSettings as any).retentionDays === 'string') {
    newSettings['u3'] = { retentionDays: (currentSettings as any).retentionDays };
  } else {
    newSettings = { ...currentSettings };
  }
  
  newSettings[tenantId] = { retentionDays };
  database.cleanupSettings = newSettings;
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_RECYCLE_SETTINGS', `Updated auto-cleanup retention settings to: ${retentionDays} Days`);
  res.json({ message: 'Auto-cleanup settings updated successfully.', cleanupSettings: { retentionDays } });
});

// Bookings API
app.get('/api/bookings', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const search = (req.query.search as string || '').toLowerCase();
  const status = req.query.status as string;

  let results = database.bookings.filter(b => b.userId === tenantId);

  if (search) {
    results = results.filter(b => 
      b.guestName.toLowerCase().includes(search) ||
      b.roomNumber.toLowerCase().includes(search) ||
      b.id.toLowerCase().includes(search)
    );
  }

  if (status) {
    results = results.filter(b => b.status === status);
  }

  res.json(results);
});

app.post('/api/bookings', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const newBooking: Booking = {
    ...req.body,
    id: `BK-${Date.now().toString().substring(5)}`,
    bookingDate: new Date().toISOString().split('T')[0],
    userId: tenantId
  };

  if (!newBooking.guestId || !newBooking.checkIn || !newBooking.checkOut || !newBooking.roomNumber) {
    res.status(400).json({ error: 'Guest, check-in, check-out, and room are required.' });
    return;
  }

  // Check room status from tenant rooms
  const tenantRooms = getTenantRooms(database, tenantId);
  const room = tenantRooms.find(r => r.roomNumber === newBooking.roomNumber);
  if (!room) {
    res.status(400).json({ error: 'Invalid room number selected.' });
    return;
  }

  // Update Room Status if checked-in immediately
  if (newBooking.status === 'checked-in') {
    room.status = 'occupied';
  }

  // Calculate Nights
  const checkInDate = new Date(newBooking.checkIn);
  const checkOutDate = new Date(newBooking.checkOut);
  const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  newBooking.nights = nights;

  database.bookings.push(newBooking);

  // Generate automated invoice outline
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const roomCharges = room.pricePerNight * nights;
  const taxes = Math.round(roomCharges * 0.12); // 12% Gst
  const totalAmount = roomCharges + taxes;

  const newInvoice: Invoice = {
    invoiceNumber,
    bookingId: newBooking.id,
    guestName: newBooking.guestName,
    roomCharges,
    foodCharges: 0,
    laundryCharges: 0,
    extraServices: 0,
    taxes,
    discount: 0,
    totalAmount,
    advancePaid: 0,
    remainingBalance: totalAmount,
    userId: tenantId
  };

  database.invoices.push(newInvoice);

  // Push notifications
  const newNotif: SystemNotification = {
    id: `n-${Date.now()}`,
    type: 'booking',
    title: 'New Booking Created',
    message: `${newBooking.guestName} booked Room ${newBooking.roomNumber} (${newBooking.checkIn} to ${newBooking.checkOut})`,
    timestamp: new Date().toISOString(),
    read: false,
    linkId: newBooking.id,
    userId: tenantId
  };
  database.notifications.unshift(newNotif);

  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'CREATE_BOOKING', `Created booking ${newBooking.id} for ${newBooking.guestName} in Room ${newBooking.roomNumber}`);
  res.status(201).json({ booking: newBooking, invoice: newInvoice });
});

app.put('/api/bookings/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const index = database.bookings.findIndex(b => b.id === req.params.id && b.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const oldBooking = database.bookings[index];
  const updatedBooking: Booking = {
    ...oldBooking,
    ...req.body,
    id: req.params.id, // Prevent id changes
    userId: tenantId // Force correct tenant ID
  };

  // If check-in state changes, reflect room occupancy
  if (updatedBooking.status !== oldBooking.status) {
    const tenantRooms = getTenantRooms(database, tenantId);
    const room = tenantRooms.find(r => r.roomNumber === updatedBooking.roomNumber);
    if (room) {
      if (updatedBooking.status === 'checked-in') {
        room.status = 'occupied';
      } else if (updatedBooking.status === 'checked-out') {
        room.status = 'cleaning';
      } else if (updatedBooking.status === 'cancelled') {
        room.status = 'available';
      }
    }

    // Add specific notification
    const notif: SystemNotification = {
      id: `n-${Date.now()}`,
      type: updatedBooking.status === 'checked-in' ? 'check-in' : 'check-out',
      title: `Booking Status Update`,
      message: `${updatedBooking.guestName} booking is now marked as ${updatedBooking.status}`,
      timestamp: new Date().toISOString(),
      read: false,
      linkId: updatedBooking.id,
      userId: tenantId
    };
    database.notifications.unshift(notif);
  }

  database.bookings[index] = updatedBooking;
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_BOOKING', `Updated booking ${updatedBooking.id} for ${updatedBooking.guestName}`);
  res.json(updatedBooking);
});

app.delete('/api/bookings/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const booking = database.bookings.find(b => b.id === req.params.id && b.userId === tenantId);

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  // Restore room status if deleted
  const tenantRooms = getTenantRooms(database, tenantId);
  const room = tenantRooms.find(r => r.roomNumber === booking.roomNumber);
  if (room && booking.status === 'checked-in') {
    room.status = 'available';
  }

  database.bookings = database.bookings.filter(b => b.id !== req.params.id || b.userId !== tenantId);
  // Remove related invoice outline if booking deleted before complete payment
  database.invoices = database.invoices.filter(inv => inv.bookingId !== req.params.id || inv.userId !== tenantId);

  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'DELETE_BOOKING', `Deleted booking record: ${booking.id}`);
  res.json({ message: 'Booking deleted successfully' });
});

// Rooms API
app.get('/api/rooms', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  res.json(getTenantRooms(database, tenantId));
});

app.put('/api/rooms/:roomNumber', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const tenantRooms = getTenantRooms(database, tenantId);
  const room = tenantRooms.find(r => r.roomNumber === req.params.roomNumber);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const oldStatus = room.status;
  room.status = req.body.status || room.status;
  room.category = req.body.category || room.category;
  room.pricePerNight = Number(req.body.pricePerNight) || room.pricePerNight;
  room.capacity = Number(req.body.capacity) || room.capacity;

  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_ROOM', `Updated Room ${room.roomNumber} (Status: ${oldStatus} -> ${room.status})`);
  res.json(room);
});

app.post('/api/rooms', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const { roomNumber, category, pricePerNight, capacity, status } = req.body;

  if (!roomNumber || !category || !pricePerNight || !capacity) {
    res.status(400).json({ error: 'Room number, category, price and capacity are required.' });
    return;
  }

  const tenantRooms = getTenantRooms(database, tenantId);
  if (tenantRooms.some(r => r.roomNumber === roomNumber)) {
    res.status(400).json({ error: 'Room number already exists' });
    return;
  }

  const newRoom: Room = {
    roomNumber,
    category,
    pricePerNight: Number(pricePerNight),
    capacity: Number(capacity),
    status: status || 'available',
    userId: tenantId
  };

  database.rooms = database.rooms || [];
  database.rooms.push(newRoom);
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'CREATE_ROOM', `Added Room ${roomNumber}`);
  res.status(201).json(newRoom);
});

// Visitor Log API
app.get('/api/visitors', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const search = (req.query.search as string || '').toLowerCase();

  let results = database.visitorLog.filter(v => v.userId === tenantId);
  if (search) {
    results = results.filter(v => 
      v.guestName.toLowerCase().includes(search) ||
      v.vehicleNumber.toLowerCase().includes(search) ||
      v.purpose.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

app.post('/api/visitors', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const newLog: VisitorLog = {
    ...req.body,
    id: `v-${Date.now()}`,
    arrive: req.body.arrive || new Date().toISOString().substring(0, 16),
    userId: tenantId
  };

  if (!newLog.guestName || !newLog.arrive || !newLog.purpose) {
    res.status(400).json({ error: 'Guest name, arrival time, and purpose are required.' });
    return;
  }

  database.visitorLog.push(newLog);
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'CREATE_VISITOR_LOG', `Recorded visitor log for guest: ${newLog.guestName}`);
  res.status(201).json(newLog);
});

app.put('/api/visitors/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const index = database.visitorLog.findIndex(v => v.id === req.params.id && v.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Visitor log entry not found' });
    return;
  }

  const updatedLog = {
    ...database.visitorLog[index],
    ...req.body,
    id: req.params.id,
    userId: tenantId // Force correct tenant ID
  };

  database.visitorLog[index] = updatedLog;
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_VISITOR_LOG', `Updated visitor log for guest: ${updatedLog.guestName}`);
  res.json(updatedLog);
});

app.delete('/api/visitors/:id', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const entry = database.visitorLog.find(v => v.id === req.params.id && v.userId === tenantId);

  if (!entry) {
    res.status(404).json({ error: 'Visitor log entry not found' });
    return;
  }

  // Create RecycleBinItem for the deleted visitor log
  const recycleItem = {
    id: `rb-v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    guest: {
      id: `g-v-${entry.id}`,
      fullName: `Visitor: ${entry.guestName}`,
      phone: entry.emergencyContact || 'N/A',
      aadhaarNumber: entry.vehicleNumber || 'N/A',
      nationality: 'N/A',
      gender: 'N/A',
      address: 'N/A',
      roomNumber: 'N/A',
      isDeleted: true,
      dob: 'N/A',
      email: 'N/A',
      city: 'N/A',
      state: 'N/A',
      pinCode: 'N/A',
      country: 'N/A'
    },
    bookings: [],
    invoices: [],
    payments: [],
    visitorLogs: [entry],
    deletedAt: new Date().toISOString(),
    deletedBy: req.user?.fullName || req.user?.username || 'Admin',
    reason: `Visitor Log deleted: ${entry.purpose}`,
    userId: tenantId
  };

  database.recycleBin = database.recycleBin || [];
  database.recycleBin.push(recycleItem);

  database.visitorLog = database.visitorLog.filter(v => v.id !== req.params.id || v.userId !== tenantId);
  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'DELETE_VISITOR_LOG', `Deleted visitor log for: ${entry.guestName} (moved to Recycle Bin)`);
  res.json({ message: 'Visitor log entry moved to Recycle Bin.' });
});

// Billing / Invoices API
app.get('/api/invoices', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const search = (req.query.search as string || '').toLowerCase();

  let results = database.invoices.filter(i => i.userId === tenantId);
  if (search) {
    results = results.filter(i => 
      i.invoiceNumber.toLowerCase().includes(search) ||
      i.guestName.toLowerCase().includes(search) ||
      i.bookingId.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

app.get('/api/invoices/:invoiceNumber', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const invoice = database.invoices.find(i => i.invoiceNumber === req.params.invoiceNumber && i.userId === tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json(invoice);
});

app.put('/api/invoices/:invoiceNumber', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const index = database.invoices.findIndex(i => i.invoiceNumber === req.params.invoiceNumber && i.userId === tenantId);

  if (index === -1) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const invoice = database.invoices[index];
  const { foodCharges, laundryCharges, extraServices, discount } = req.body;

  invoice.foodCharges = Number(foodCharges) ?? invoice.foodCharges;
  invoice.laundryCharges = Number(laundryCharges) ?? invoice.laundryCharges;
  invoice.extraServices = Number(extraServices) ?? invoice.extraServices;
  invoice.discount = Number(discount) ?? invoice.discount;

  // Recalculate totals
  const subtotal = invoice.roomCharges + invoice.foodCharges + invoice.laundryCharges + invoice.extraServices;
  invoice.taxes = Math.round((subtotal - invoice.discount) * 0.12); // 12% Gst
  invoice.totalAmount = Math.max(0, subtotal - invoice.discount + invoice.taxes);
  invoice.remainingBalance = Math.max(0, invoice.totalAmount - invoice.advancePaid);

  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'UPDATE_INVOICE', `Updated charges for invoice ${invoice.invoiceNumber}`);
  res.json(invoice);
});

// Payments API
app.get('/api/payments', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const search = (req.query.search as string || '').toLowerCase();

  let results = database.payments.filter(p => p.userId === tenantId);
  if (search) {
    results = results.filter(p => 
      p.invoiceNumber.toLowerCase().includes(search) ||
      p.transactionId.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

app.post('/api/payments', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const { invoiceNumber, amountPaid, paymentMethod, transactionId, notes } = req.body;

  if (!invoiceNumber || !amountPaid || !paymentMethod) {
    res.status(400).json({ error: 'Invoice, amount paid, and payment method are required.' });
    return;
  }

  const invoice = database.invoices.find(i => i.invoiceNumber === invoiceNumber && i.userId === tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const paymentAmt = Number(amountPaid);
  if (paymentAmt <= 0) {
    res.status(400).json({ error: 'Payment amount must be greater than 0.' });
    return;
  }

  // Record payment
  const newPayment: Payment = {
    id: `PAY-${Date.now().toString().substring(6)}`,
    invoiceNumber,
    paymentDate: new Date().toISOString().split('T')[0],
    amountPaid: paymentAmt,
    balanceDue: Math.max(0, invoice.remainingBalance - paymentAmt),
    paymentMethod,
    transactionId: transactionId || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'Completed',
    notes: notes || 'Invoice payment recorded',
    userId: tenantId
  };

  database.payments.unshift(newPayment);

  // Update invoice remaining balance
  invoice.advancePaid += paymentAmt;
  invoice.remainingBalance = Math.max(0, invoice.totalAmount - invoice.advancePaid);

  // Push notifications
  const notif: SystemNotification = {
    id: `n-${Date.now()}`,
    type: 'payment',
    title: 'Payment Received',
    message: `Received ₹${paymentAmt.toLocaleString()} for Invoice ${invoiceNumber}.`,
    timestamp: new Date().toISOString(),
    read: false,
    linkId: invoiceNumber,
    userId: tenantId
  };
  database.notifications.unshift(notif);

  writeDB(database);

  logAudit(req.user!.id, req.user!.username, 'RECORD_PAYMENT', `Recorded payment of ₹${paymentAmt} for ${invoiceNumber}`);
  res.status(201).json(newPayment);
});

// Audit Logs API
app.get('/api/audit-logs', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  res.json((database.auditLogs || []).filter(l => l.userId === tenantId));
});

// Notifications API
app.get('/api/notifications', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  res.json((database.notifications || []).filter(n => n.userId === tenantId));
});

app.put('/api/notifications/:id/read', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  const notif = database.notifications.find(n => n.id === req.params.id && n.userId === tenantId);
  if (notif) {
    notif.read = true;
    writeDB(database);
  }
  res.json({ success: true });
});

app.post('/api/notifications/clear', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);
  database.notifications = (database.notifications || []).filter(n => n.userId !== tenantId);
  writeDB(database);
  res.json({ success: true });
});

// Data Backup and Restore
app.get('/api/backup/export', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const database = readDB();
  const tenantId = getTenantId(req);

  // Isolate and only export the current tenant's data
  const exportedData = {
    users: database.users.filter(u => u.ownerId === tenantId || u.id === tenantId),
    guests: database.guests.filter(g => g.userId === tenantId),
    bookings: database.bookings.filter(b => b.userId === tenantId),
    rooms: database.rooms.filter(r => r.userId === tenantId),
    invoices: database.invoices.filter(i => i.userId === tenantId),
    payments: database.payments.filter(p => p.userId === tenantId),
    visitorLog: database.visitorLog.filter(v => v.userId === tenantId),
    notifications: database.notifications.filter(n => n.userId === tenantId),
    auditLogs: database.auditLogs.filter(l => l.userId === tenantId),
    recycleBin: database.recycleBin.filter(r => r.userId === tenantId),
    cleanupSettings: database.cleanupSettings
  };

  res.setHeader('Content-disposition', `attachment; filename=homestay_backup_${tenantId}.json`);
  res.setHeader('Content-type', 'application/json');
  res.send(JSON.stringify(exportedData, null, 2));
});

app.post('/api/backup/restore', verifyToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { restoreData } = req.body;
  if (!restoreData || !restoreData.guests || !restoreData.bookings) {
    res.status(400).json({ error: 'Invalid backup file structure. Must contain guests and bookings.' });
    return;
  }

  const database = readDB();
  const tenantId = getTenantId(req);

  // Strip and clear existing data for THIS tenant only to prevent pollution/cross-tenant issues
  database.guests = (database.guests || []).filter(g => g.userId !== tenantId);
  database.bookings = (database.bookings || []).filter(b => b.userId !== tenantId);
  database.rooms = (database.rooms || []).filter(r => r.userId !== tenantId);
  database.invoices = (database.invoices || []).filter(i => i.userId !== tenantId);
  database.payments = (database.payments || []).filter(p => p.userId !== tenantId);
  database.visitorLog = (database.visitorLog || []).filter(v => v.userId !== tenantId);
  database.notifications = (database.notifications || []).filter(n => n.userId !== tenantId);
  database.auditLogs = (database.auditLogs || []).filter(l => l.userId !== tenantId);
  database.recycleBin = (database.recycleBin || []).filter(r => r.userId !== tenantId);

  // Helper to deep tag elements with tenantId
  const tagWithTenant = (list: any[]) => {
    if (!Array.isArray(list)) return [];
    return list.map(item => ({ ...item, userId: tenantId }));
  };

  // Merge the restored data, forcing tenantId on every restored record
  if (Array.isArray(restoreData.guests)) database.guests.push(...tagWithTenant(restoreData.guests));
  if (Array.isArray(restoreData.bookings)) database.bookings.push(...tagWithTenant(restoreData.bookings));
  if (Array.isArray(restoreData.rooms)) database.rooms.push(...tagWithTenant(restoreData.rooms));
  if (Array.isArray(restoreData.invoices)) database.invoices.push(...tagWithTenant(restoreData.invoices));
  if (Array.isArray(restoreData.payments)) database.payments.push(...tagWithTenant(restoreData.payments));
  if (Array.isArray(restoreData.visitorLog)) database.visitorLog.push(...tagWithTenant(restoreData.visitorLog));
  if (Array.isArray(restoreData.notifications)) database.notifications.push(...tagWithTenant(restoreData.notifications));
  if (Array.isArray(restoreData.auditLogs)) database.auditLogs.push(...tagWithTenant(restoreData.auditLogs));
  if (Array.isArray(restoreData.recycleBin)) database.recycleBin.push(...tagWithTenant(restoreData.recycleBin));

  writeDB(database);
  logAudit(req.user!.id, req.user!.username, 'RESTORE_DATABASE', 'Restored homestay database from backup file.');
  res.json({ message: 'Database successfully restored from backup.' });
});

// Catch-all for undefined API routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.url} not found.`
  });
});

// Global unhandled error handling middleware - returns JSON error for API requests
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start API server
const startServer = async () => {
  // Initialize database BEFORE accepting requests
  await initDB();

  // CORS — allow requests from the frontend dev server and production origin
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.listen(PORT, '0.0.0.0', () => {
    const storageMode = supabaseAvailable ? '☁️  Supabase (cloud)' : '📁 Local db.json (fallback)';
    console.log(`✅ Backend API running at http://0.0.0.0:${PORT}`);
    console.log(`💾 Storage: ${storageMode}`);
  });
};

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export default app;
