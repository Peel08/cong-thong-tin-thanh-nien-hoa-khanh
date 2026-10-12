// ==================================================================
// HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU SQLITE & TURSO CLOUD (LIBSQL)
// CỔNG THÔNG TIN THANH NIÊN XÃ HÒA KHÁNH - TÂY NINH
// Nghiên cứu & phát triển: Lương Tấn Phát
// Hỗ trợ chế độ Hybrid:
// - Chạy cục bộ: SQLite file (data/hoakhanh.db)
// - Triển khai Render: Turso Cloud SQLite (Dữ liệu vĩnh viễn không mất)
// ==================================================================

const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'hoakhanh.db');

// Kiểm tra biến môi trường Turso Cloud
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let client;
let dbMode = 'local_sqlite';

if (tursoUrl) {
  client = createClient({
    url: tursoUrl,
    authToken: tursoToken || undefined
  });
  dbMode = 'turso_cloud';
  console.log('✓ [SQL] Đang kết nối Turso Cloud Database:', tursoUrl);
} else {
  const fileUrl = 'file:' + path.resolve(DB_PATH).replace(/\\/g, '/');
  client = createClient({
    url: fileUrl
  });
  dbMode = 'local_sqlite';
  console.log('✓ [SQL] Đang kết nối cơ sở dữ liệu SQLite cục bộ:', DB_PATH);
}

function getDbMode() {
  return dbMode;
}

// ==========================================
// 1. KHỞI TẠO BẢNG & DI CHUYỂN DỮ LIỆU (DDL)
// ==========================================
async function initDb() {
  try {
    // 1.1 Tạo các bảng SQL chuẩn
    await client.execute(`
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
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS volunteers (
        id TEXT PRIMARY KEY,
        full_name TEXT,
        phone TEXT,
        hamlet TEXT,
        email TEXT,
        squad_name TEXT,
        note TEXT,
        created_at TEXT
      )
    `);

    await client.execute(`
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
      )
    `);

    await client.execute(`
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
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      )
    `);

    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_name ON attendance(name)`);

    console.log('✓ [SQL DDL] Khởi tạo bảng thành công.');

    // 1.2 Tự động di chuyển dữ liệu JSON nếu bảng trống
    await migrateFromJson();

    // 1.3 Đảm bảo tài khoản quản trị viên admin luôn tồn tại
    await ensureAdminExists();

    // 1.4 Khôi phục cấu hình database.json từ bảng settings nếu trên container mới
    await restoreDatabaseJsonFromSettings();

    console.log(`✓ [SQL HOÀN TẤT] Hệ quản trị cơ sở dữ liệu sẵn sàng (${dbMode})!`);
  } catch (err) {
    console.error('❌ Lỗi khởi tạo cơ sở dữ liệu SQL:', err);
  }
}

// Tự động chuyển đổi dữ liệu từ JSON vào SQL
async function migrateFromJson() {
  try {
    // Users
    const uRes = await client.execute('SELECT COUNT(*) as count FROM users');
    const usersCount = Number(uRes.rows[0].count);
    const usersJsonPath = path.join(DATA_DIR, 'users.json');
    if (usersCount === 0 && fs.existsSync(usersJsonPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8') || '[]');
      for (const u of usersData) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO users (id, username, password, full_name, role, hamlet, phone, email, is_email_verified, verified_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
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
          ]
        });
      }
      console.log(`✓ Đã nạp ${usersData.length} tài khoản từ users.json vào bảng users (SQL)!`);
    }

    // Volunteers
    const vRes = await client.execute('SELECT COUNT(*) as count FROM volunteers');
    const volCount = Number(vRes.rows[0].count);
    const volJsonPath = path.join(DATA_DIR, 'volunteers.json');
    if (volCount === 0 && fs.existsSync(volJsonPath)) {
      const volData = JSON.parse(fs.readFileSync(volJsonPath, 'utf8') || '[]');
      for (const v of volData) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO volunteers (id, full_name, phone, hamlet, email, squad_name, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            v.id || ('VOL-' + Date.now()),
            v.fullName || v.name || '',
            v.phone || '',
            v.hamlet || '',
            v.email || '',
            v.squad || v.squadName || '',
            v.note || '',
            v.createdAt || ''
          ]
        });
      }
      console.log(`✓ Đã nạp ${volData.length} lượt đăng ký tình nguyện vào bảng volunteers (SQL)!`);
    }

    // Ideas
    const iRes = await client.execute('SELECT COUNT(*) as count FROM ideas');
    const ideaCount = Number(iRes.rows[0].count);
    const ideaJsonPath = path.join(DATA_DIR, 'ideas.json');
    if (ideaCount === 0 && fs.existsSync(ideaJsonPath)) {
      const ideaData = JSON.parse(fs.readFileSync(ideaJsonPath, 'utf8') || '[]');
      for (const i of ideaData) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO ideas (id, full_name, phone, hamlet, email, title, content, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            i.id || ('IDEA-' + Date.now()),
            i.fullName || i.name || '',
            i.phone || '',
            i.hamlet || '',
            i.email || '',
            i.title || '',
            i.content || '',
            i.status || 'Đã tiếp nhận',
            i.createdAt || ''
          ]
        });
      }
      console.log(`✓ Đã nạp ${ideaData.length} hiến kế thanh niên vào bảng ideas (SQL)!`);
    }

    // Attendance
    const aRes = await client.execute('SELECT COUNT(*) as count FROM attendance');
    const attCount = Number(aRes.rows[0].count);
    const attJsonPath = path.join(DATA_DIR, 'attendance.json');
    if (attCount === 0 && fs.existsSync(attJsonPath)) {
      const attData = JSON.parse(fs.readFileSync(attJsonPath, 'utf8') || '[]');
      for (const a of attData) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method, face_descriptor, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
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
          ]
        });
      }
      console.log(`✓ Đã nạp ${attData.length} đại biểu điểm danh vào bảng attendance (SQL)!`);
    }

    // Settings (database.json)
    const dbJsonPath = path.join(DATA_DIR, 'database.json');
    if (fs.existsSync(dbJsonPath)) {
      const dbData = fs.readFileSync(dbJsonPath, 'utf8');
      await client.execute({
        sql: `INSERT INTO settings (key, value, updated_at)
              VALUES ('organization_data', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [dbData, new Date().toLocaleString('vi-VN')]
      });
    }
  } catch (err) {
    console.warn('Lỗi khi migrate dữ liệu từ JSON sang SQL:', err.message);
  }
}

// Đảm bảo tài khoản admin luôn tồn tại
async function ensureAdminExists() {
  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE LOWER(username) = 'admin'",
    args: []
  });
  if (existing.rows.length === 0) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password, full_name, role, hamlet, phone, email, is_email_verified, verified_at, created_at)
            VALUES (?, 'admin', 'admin123', 'Quản Trị Viên BCH Đoàn Xã Hòa Khánh', 'admin', 'BCH Đoàn Xã Hòa Khánh', '0947463036', '', 0, '', ?)`,
      args: ['USR-ADMIN-01', new Date().toLocaleString('vi-VN')]
    });
    console.log('✓ Đã tạo tài khoản quản trị viên mặc định (admin / admin123).');
  }
}

// Khôi phục database.json nếu chạy trên container mới của Cloud
async function restoreDatabaseJsonFromSettings() {
  const dbJsonPath = path.join(DATA_DIR, 'database.json');
  try {
    const sRes = await client.execute({
      sql: "SELECT value FROM settings WHERE key = 'organization_data'",
      args: []
    });
    if (sRes.rows.length > 0 && sRes.rows[0].value) {
      // Nếu file database.json chưa có hoặc rỗng thì ghi lại từ Cloud SQL
      if (!fs.existsSync(dbJsonPath) || fs.statSync(dbJsonPath).size < 10) {
        fs.writeFileSync(dbJsonPath, sRes.rows[0].value, 'utf8');
        console.log('✓ Đã khôi phục file database.json từ cơ sở dữ liệu Cloud SQL!');
      }
    }
  } catch (e) {
    console.warn('Lỗi khôi phục database.json từ settings:', e.message);
  }
}

// ==========================================
// 2. CÁC HÀM TRUY VẤN SQL CHUẨN (DAO)
// ==========================================

// --- USERS ---
async function findUserByUsername(username) {
  if (!username) return null;
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
    args: [username.trim()]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
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

async function findUserByEmail(email) {
  if (!email) return null;
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
    args: [email.trim()]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
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

async function getAllUsers() {
  const res = await client.execute('SELECT * FROM users ORDER BY created_at DESC');
  return res.rows.map(r => ({
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

async function upsertUser(user) {
  await client.execute({
    sql: `INSERT INTO users (id, username, password, full_name, role, hamlet, phone, email, is_email_verified, verified_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            password = excluded.password,
            full_name = excluded.full_name,
            hamlet = excluded.hamlet,
            phone = excluded.phone,
            email = excluded.email,
            is_email_verified = excluded.is_email_verified,
            verified_at = excluded.verified_at`,
    args: [
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
    ]
  });

  await syncUsersJson();
}

async function syncUsersJson() {
  try {
    const all = await getAllUsers();
    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {}
}

// --- VOLUNTEERS ---
async function getVolunteers() {
  const res = await client.execute('SELECT * FROM volunteers ORDER BY created_at DESC');
  return res.rows.map(r => ({
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

async function addVolunteer(v) {
  const id = v.id || ('VOL-' + Date.now());
  const createdAt = v.createdAt || new Date().toLocaleString('vi-VN');
  await client.execute({
    sql: `INSERT INTO volunteers (id, full_name, phone, hamlet, email, squad_name, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      v.fullName || v.name || '',
      v.phone || '',
      v.hamlet || '',
      v.email || '',
      v.squad || v.squadName || '',
      v.note || '',
      createdAt
    ]
  });

  await syncVolunteersJson();
  return { ...v, id, createdAt };
}

async function deleteVolunteer(id) {
  await client.execute({
    sql: 'DELETE FROM volunteers WHERE id = ?',
    args: [id]
  });
  await syncVolunteersJson();
}

async function syncVolunteersJson() {
  try {
    const all = await getVolunteers();
    fs.writeFileSync(path.join(DATA_DIR, 'volunteers.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {}
}

// --- IDEAS ---
async function getIdeas() {
  const res = await client.execute('SELECT * FROM ideas ORDER BY created_at DESC');
  return res.rows.map(r => ({
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

async function addIdea(item) {
  const id = item.id || ('IDEA-' + Date.now());
  const createdAt = item.createdAt || new Date().toLocaleDateString('vi-VN');
  const status = item.status || 'Đã tiếp nhận';
  await client.execute({
    sql: `INSERT INTO ideas (id, full_name, phone, hamlet, email, title, content, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      item.fullName || item.name || '',
      item.phone || '',
      item.hamlet || '',
      item.email || '',
      item.title || '',
      item.content || '',
      status,
      createdAt
    ]
  });

  await syncIdeasJson();
  return { ...item, id, createdAt, status };
}

async function updateIdeaStatus(id, status) {
  await client.execute({
    sql: 'UPDATE ideas SET status = ? WHERE id = ?',
    args: [status, id]
  });
  await syncIdeasJson();
}

async function syncIdeasJson() {
  try {
    const all = await getIdeas();
    fs.writeFileSync(path.join(DATA_DIR, 'ideas.json'), JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {}
}

// --- ATTENDANCE & CHECKIN ---
async function getAttendanceList() {
  const res = await client.execute('SELECT * FROM attendance');
  return res.rows.map(r => {
    let faceDescriptor = null;
    if (r.face_descriptor) {
      try {
        faceDescriptor = JSON.parse(r.face_descriptor);
      } catch (e) {}
    }
    return {
      id: r.id,
      name: r.name,
      hamlet: r.hamlet,
      role: r.role,
      avatar: r.avatar,
      qrData: r.qr_data,
      checkedIn: !!r.checked_in,
      checkinTime: r.checkin_time,
      method: r.method,
      faceDescriptor
    };
  });
}

async function checkinDelegate(searchKey, name, hamlet, method = 'FaceID') {
  const res = await client.execute('SELECT * FROM attendance');
  const rows = res.rows;
  let found = rows.find(r => (searchKey && (r.id === searchKey || r.qr_data === searchKey)) || (name && (r.name || '').toLowerCase() === (name || '').toLowerCase()));

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  if (found) {
    await client.execute({
      sql: 'UPDATE attendance SET checked_in = 1, checkin_time = ?, method = ? WHERE id = ?',
      args: [timeStr, method, found.id]
    });
    found.checked_in = 1;
    found.checkin_time = timeStr;
    found.method = method;
  } else if (name) {
    const newId = 'HK-ADD-' + Date.now().toString().slice(-4);
    await client.execute({
      sql: `INSERT INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method, created_at)
            VALUES (?, ?, ?, ?, '', ?, 1, ?, ?, ?)`,
      args: [
        newId,
        name,
        hamlet || 'Ấp Thuận Hòa 1',
        'Đại biểu thanh niên',
        newId,
        timeStr,
        method,
        new Date().toLocaleString('vi-VN')
      ]
    });
    found = {
      id: newId,
      name,
      hamlet: hamlet || 'Ấp Thuận Hòa 1',
      role: 'Đại biểu thanh niên',
      avatar: '',
      qr_data: newId,
      checked_in: 1,
      checkin_time: timeStr,
      method
    };
  }

  await syncAttendanceJson();
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

async function upsertDelegate(body) {
  const check = await client.execute({
    sql: 'SELECT id FROM attendance WHERE id = ?',
    args: [body.id || '']
  });

  if (check.rows.length > 0) {
    await client.execute({
      sql: `UPDATE attendance SET
              name = COALESCE(?, name),
              hamlet = COALESCE(?, hamlet),
              role = COALESCE(?, role),
              avatar = COALESCE(?, avatar),
              qr_data = COALESCE(?, qr_data),
              face_descriptor = COALESCE(?, face_descriptor)
            WHERE id = ?`,
      args: [
        body.name,
        body.hamlet,
        body.role,
        body.avatar,
        body.qrData,
        body.faceDescriptor ? JSON.stringify(body.faceDescriptor) : null,
        body.id
      ]
    });
  } else {
    const newId = body.id || ('HK-DB-' + Date.now().toString().slice(-4));
    await client.execute({
      sql: `INSERT INTO attendance (id, name, hamlet, role, avatar, qr_data, checked_in, checkin_time, method, face_descriptor, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)`,
      args: [
        newId,
        body.name || 'Đại biểu',
        body.hamlet || 'Ấp Thuận Hòa 1',
        body.role || 'Đại biểu thanh niên',
        body.avatar || '',
        body.qrData || newId,
        body.faceDescriptor ? JSON.stringify(body.faceDescriptor) : null,
        new Date().toLocaleString('vi-VN')
      ]
    });
  }
  await syncAttendanceJson();
}

async function syncAttendanceJson() {
  try {
    const list = await getAttendanceList();
    fs.writeFileSync(path.join(DATA_DIR, 'attendance.json'), JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

// --- SETTINGS ---
async function getSetting(key, defaultVal = {}) {
  try {
    const res = await client.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: [key]
    });
    if (res.rows.length === 0) return defaultVal;
    return JSON.parse(res.rows[0].value);
  } catch (e) {
    return defaultVal;
  }
}

async function saveSetting(key, val) {
  const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, str, new Date().toLocaleString('vi-VN')]
  });

  if (key === 'organization_data') {
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'database.json'), str, 'utf8');
    } catch (e) {}
  }
}

// --- XÓA ĐẠI BIỂU ---
async function deleteDelegate(id) {
  await client.execute({
    sql: 'DELETE FROM attendance WHERE id = ?',
    args: [id]
  });
  await syncAttendanceJson();
}

// --- RESET ĐIỂM DANH ---
async function resetAttendance() {
  await client.execute('UPDATE attendance SET checked_in = 0, checkin_time = NULL, method = NULL');
  await syncAttendanceJson();
}

module.exports = {
  client,
  initDb,
  getDbMode,
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
  deleteDelegate,
  resetAttendance,
  syncAttendanceJson,
  getSetting,
  saveSetting
};
