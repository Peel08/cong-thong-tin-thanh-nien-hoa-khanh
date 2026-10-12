// ==================================================================
// HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU SQLITE (BUILT-IN NODE.JS SQLITE)
// CỔNG THÔNG TIN THANH NIÊN XÃ HÒA KHÁNH - TÂY NINH
// Nghiên cứu & phát triển: Lương Tấn Phát
// ==================================================================

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'hoakhanh.db');
const db = new DatabaseSync(DB_PATH);

// Bật chế độ WAL để tăng tốc độ ghi/đọc song song
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (e) {
  // Ignored
}

// 1. KHỞI TẠO CÁC BẢNG CƠ SỞ DỮ LIỆU SQL (DDL)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    hamlet TEXT,
    phone TEXT,
    email TEXT,
    is_email_verified INTEGER DEFAULT 0,
    verified_at TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS volunteers (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    hamlet TEXT,
    email TEXT,
    squad_name TEXT,
    note TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    hamlet TEXT,
    email TEXT,
    title TEXT,
    content TEXT,
    status TEXT DEFAULT 'Đã tiếp nhận',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hamlet TEXT,
    role TEXT,
    avatar TEXT,
    qr_data TEXT,
    checked_in INTEGER DEFAULT 0,
    checkin_time TEXT,
    method TEXT,
    face_descriptor TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_attendance_name ON attendance(name);
`);

console.log('✓ Đã kết nối cơ sở dữ liệu SQL (SQLite):', DB_PATH);

// 2. TỰ ĐỘNG CHUYỂN ĐỔI DỮ LIỆU TỪ JSON CŨ VÀO SQL (AUTO-MIGRATION)
function migrateFromJson() {
  try {
    // 2.1 Migrate users
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const usersJsonPath = path.join(DATA_DIR, 'users.json');
    if (usersCount === 0 && fs.existsSync(usersJsonPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8') || '[]');
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, username, password, full_name, role, hamlet, phone, email, is_email_verified, verified_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const u of usersData) {
        insertUser.run(
          u.id || ('USR-' + Date.now()),
          (u.username || '').toLowerCase(),
          u.password || 'admin123',
          u.fullName || u.full_name || 'Người dùng',
          u.role || 'member',
          u.hamlet || '',
          u.phone || '',
          u.email || '',
          u.isEmailVerified ? 1 : 0,
          u.verifiedAt || '',
          u.createdAt || ''
        );
      }
      console.log(`✓ Đã nạp ${usersData.length} tài khoản từ users.json vào bảng users (SQL)!`);
    }

    // 2.2 Migrate volunteers
    const volCount = db.prepare('SELECT COUNT(*) as count FROM volunteers').get().count;
    const volJsonPath = path.join(DATA_DIR, 'volunteers.json');
    if (volCount === 0 && fs.existsSync(volJsonPath)) {
      const volData = JSON.parse(fs.readFileSync(volJsonPath, 'utf8') || '[]');
      const insertVol = db.prepare(`
        INSERT OR IGNORE INTO volunteers (id, full_name, phone, hamlet, email, squad_name, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const v of volData) {
        insertVol.run(
          v.id || ('VOL-' + Date.now()),
          v.fullName || v.name || '',
          v.phone || '',
          v.hamlet || '',
          v.email || '',
          v.squad || v.squadName || '',
          v.note || '',
          v.createdAt || ''
        );
      }
      console.log(`✓ Đã nạp ${volData.length} lượt đăng ký tình nguyện vào bảng volunteers (SQL)!`);
    }

    // 2.3 Migrate ideas
    const ideaCount = db.prepare('SELECT COUNT(*) as count FROM ideas').get().count;
    const ideaJsonPath = path.join(DATA_DIR, 'ideas.json');
    if (ideaCount === 0 && fs.existsSync(ideaJsonPath)) {
      const ideaData = JSON.parse(fs.readFileSync(ideaJsonPath, 'utf8') || '[]');
      const insertIdea = db.prepare(`
        INSERT OR IGNORE INTO ideas (id, full_name, phone, hamlet, email, title, content, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const i of ideaData) {
        insertIdea.run(
          i.id || ('IDEA-' + Date.now()),
          i.fullName || i.name || '',
          i.phone || '',
          i.hamlet || '',
          i.email || '',
          i.title || '',
          i.content || '',
          i.status || 'Đã tiếp nhận',
          i.createdAt || ''
        );
      }
      console.log(`✓ Đã nạp ${ideaData.length} hiến kế thanh niên vào bảng ideas (SQL)!`);
    }

    // 2.4 Migrate attendance
    const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
    const attJsonPath = path.join(DATA_DIR, 'attendance.json');
    if (attCount === 0 && fs.existsSync(attJsonPath)) {
      const attData = JSON.parse(fs.readFileSync(attJsonPath, 'utf8') || '[]');
      const insertAtt = db.prepare(`
        INSERT OR IGNORE INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method, face_descriptor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of attData) {
        insertAtt.run(
          a.id || ('ATT-' + Date.now()),
          a.name || 'Đại biểu',
          a.hamlet || '',
          a.role || '',
          a.avatar || '',
          a.qrData || a.id || '',
          a.checkedIn ? 1 : 0,
          a.checkinTime || '',
          a.method || '',
          a.faceDescriptor ? JSON.stringify(a.faceDescriptor) : '',
          a.createdAt || ''
        );
      }
      console.log(`✓ Đã nạp ${attData.length} đại biểu điểm danh vào bảng attendance (SQL)!`);
    }

    // 2.5 Migrate database.json settings
    const dbJsonPath = path.join(DATA_DIR, 'database.json');
    if (fs.existsSync(dbJsonPath)) {
      const dbData = fs.readFileSync(dbJsonPath, 'utf8');
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('organization_data', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(dbData, new Date().toLocaleString('vi-VN'));
    }
  } catch (err) {
    console.warn('Lỗi khi migrate dữ liệu từ JSON sang SQL:', err.message);
  }
}

migrateFromJson();

// ==========================================
// 3. CÁC HÀM TRUY VẤN SQL CHUẨN (DAO)
// ==========================================

// --- USERS ---
function findUserByUsername(username) {
  const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    fullName: row.full_name,
    role: row.role,
    hamlet: row.hamlet,
    phone: row.phone,
    email: row.email,
    isEmailVerified: !!row.is_email_verified,
    verifiedAt: row.verified_at,
    createdAt: row.created_at
  };
}

function findUserByEmail(email) {
  const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    fullName: row.full_name,
    role: row.role,
    hamlet: row.hamlet,
    phone: row.phone,
    email: row.email,
    isEmailVerified: !!row.is_email_verified,
    verifiedAt: row.verified_at,
    createdAt: row.created_at
  };
}

function getAllUsers() {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return rows.map(r => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    hamlet: r.hamlet,
    phone: r.phone,
    email: r.email,
    isEmailVerified: !!r.is_email_verified,
    createdAt: r.created_at
  }));
}

function upsertUser(user) {
  const stmt = db.prepare(`
    INSERT INTO users (id, username, password, full_name, role, hamlet, phone, email, is_email_verified, verified_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      full_name = excluded.full_name,
      hamlet = excluded.hamlet,
      phone = excluded.phone,
      email = excluded.email,
      is_email_verified = excluded.is_email_verified,
      verified_at = excluded.verified_at
  `);
  stmt.run(
    user.id || ('USR-' + Date.now()),
    (user.username || '').toLowerCase(),
    user.password,
    user.fullName || user.full_name,
    user.role || 'member',
    user.hamlet || '',
    user.phone || '',
    user.email || '',
    user.isEmailVerified ? 1 : 0,
    user.verifiedAt || new Date().toLocaleString('vi-VN'),
    user.createdAt || new Date().toLocaleString('vi-VN')
  );

  // Đồng bộ backup ra file JSON
  syncUsersJson();
}

function syncUsersJson() {
  try {
    const all = db.prepare('SELECT * FROM users').all().map(r => ({
      id: r.id,
      username: r.username,
      password: r.password,
      fullName: r.full_name,
      role: r.role,
      hamlet: r.hamlet,
      phone: r.phone,
      email: r.email,
      isEmailVerified: !!r.is_email_verified,
      verifiedAt: r.verified_at,
      createdAt: r.created_at
    }));
    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {
    // Ignored
  }
}

// --- VOLUNTEERS ---
function getVolunteers() {
  const rows = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
  return rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    hamlet: r.hamlet,
    email: r.email,
    squad: r.squad_name,
    squadName: r.squad_name,
    note: r.note,
    createdAt: r.created_at
  }));
}

function addVolunteer(v) {
  const id = v.id || ('VOL-' + Date.now());
  const createdAt = v.createdAt || new Date().toLocaleString('vi-VN');
  db.prepare(`
    INSERT INTO volunteers (id, full_name, phone, hamlet, email, squad_name, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, v.fullName || v.name || '', v.phone || '', v.hamlet || '', v.email || '', v.squad || v.squadName || '', v.note || '', createdAt);

  syncVolunteersJson();
  return { ...v, id, createdAt };
}

function deleteVolunteer(id) {
  db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
  syncVolunteersJson();
}

function syncVolunteersJson() {
  try {
    const all = getVolunteers();
    fs.writeFileSync(path.join(DATA_DIR, 'volunteers.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {}
}

// --- IDEAS ---
function getIdeas() {
  const rows = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC').all();
  return rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    hamlet: r.hamlet,
    email: r.email,
    title: r.title,
    content: r.content,
    status: r.status,
    createdAt: r.created_at
  }));
}

function addIdea(item) {
  const id = item.id || ('IDEA-' + Date.now());
  const createdAt = item.createdAt || new Date().toLocaleDateString('vi-VN');
  const status = item.status || 'Đã tiếp nhận';
  db.prepare(`
    INSERT INTO ideas (id, full_name, phone, hamlet, email, title, content, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, item.fullName || item.name || '', item.phone || '', item.hamlet || '', item.email || '', item.title || '', item.content || '', status, createdAt);

  syncIdeasJson();
  return { ...item, id, createdAt, status };
}

function updateIdeaStatus(id, status) {
  db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(status, id);
  syncIdeasJson();
}

function syncIdeasJson() {
  try {
    const all = getIdeas();
    fs.writeFileSync(path.join(DATA_DIR, 'ideas.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {}
}

// --- ATTENDANCE & CHECKIN ---
function getAttendanceList() {
  const rows = db.prepare('SELECT * FROM attendance').all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    hamlet: r.hamlet,
    role: r.role,
    avatar: r.avatar,
    qrData: r.qr_data,
    checkedIn: !!r.checked_in,
    checkinTime: r.checkin_time,
    method: r.method,
    faceDescriptor: r.face_descriptor ? JSON.parse(r.face_descriptor) : null
  }));
}

function checkinDelegate(searchKey, name, hamlet, method = 'FaceID') {
  const rows = db.prepare('SELECT * FROM attendance').all();
  let found = rows.find(r => (searchKey && (r.id === searchKey || r.qr_data === searchKey)) || (name && r.name.toLowerCase() === name.toLowerCase()));

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  if (found) {
    db.prepare('UPDATE attendance SET checked_in = 1, checkin_time = ?, method = ? WHERE id = ?').run(timeStr, method, found.id);
    found.checked_in = 1;
    found.checkin_time = timeStr;
    found.method = method;
  } else if (name) {
    const newId = 'HK-ADD-' + Date.now().toString().slice(-4);
    db.prepare(`
      INSERT INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      newId,
      name,
      hamlet || 'Ấp Thuận Hòa 1',
      'Đại biểu thanh niên',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      newId,
      timeStr,
      method
    );
    found = {
      id: newId,
      name,
      hamlet: hamlet || 'Ấp Thuận Hòa 1',
      role: 'Đại biểu thanh niên',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      qr_data: newId,
      checked_in: 1,
      checkin_time: timeStr,
      method
    };
  }

  syncAttendanceJson();
  return found ? {
    id: found.id,
    name: found.name,
    hamlet: found.hamlet,
    role: found.role,
    avatar: found.avatar,
    qrData: found.qr_data || found.qrData,
    checkedIn: true,
    checkinTime: timeStr,
    method
  } : null;
}

function upsertDelegate(body) {
  const exists = db.prepare('SELECT id FROM attendance WHERE id = ?').get(body.id);
  if (exists) {
    db.prepare(`
      UPDATE attendance SET
        name = COALESCE(?, name),
        hamlet = COALESCE(?, hamlet),
        role = COALESCE(?, role),
        avatar = COALESCE(?, avatar),
        qr_data = COALESCE(?, qr_data),
        face_descriptor = COALESCE(?, face_descriptor)
      WHERE id = ?
    `).run(
      body.name,
      body.hamlet,
      body.role,
      body.avatar,
      body.qrData,
      body.faceDescriptor ? JSON.stringify(body.faceDescriptor) : null,
      body.id
    );
  } else {
    const newId = body.id || ('HK-DB-' + Date.now().toString().slice(-4));
    db.prepare(`
      INSERT INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method, face_descriptor)
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)
    `).run(
      newId,
      body.name || 'Đại biểu',
      body.hamlet || 'Ấp Thuận Hòa 1',
      body.role || 'Đại biểu thanh niên',
      body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      body.qrData || newId,
      body.faceDescriptor ? JSON.stringify(body.faceDescriptor) : null
    );
  }
  syncAttendanceJson();
}

function syncAttendanceJson() {
  try {
    const list = getAttendanceList();
    fs.writeFileSync(path.join(DATA_DIR, 'attendance.json'), JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

// --- SETTINGS ---
function getSetting(key, defaultVal = {}) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return defaultVal;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return defaultVal;
  }
}

function saveSetting(key, val) {
  const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, str, new Date().toLocaleString('vi-VN'));

  if (key === 'organization_data') {
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'database.json'), str, 'utf8');
    } catch (e) {}
  }
}

module.exports = {
  db,
  findUserByUsername,
  findUserByEmail,
  getAllUsers,
  upsertUser,
  getVolunteers,
  addVolunteer,
  deleteVolunteer,
  getIdeas,
  addIdea,
  updateIdeaStatus,
  getAttendanceList,
  checkinDelegate,
  upsertDelegate,
  getSetting,
  saveSetting
};
