/**
 * MÁY CHỦ CƠ SỞ DỮ LIỆU & CỔNG THÔNG TIN THANH NIÊN HÒA KHÁNH (TÂY NINH)
 * Sử dụng Node.js thuần (Zero-dependency), lưu trữ dữ liệu vĩnh viễn trên đĩa cứng (Persistent Storage).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const UPLOADS_DIR = path.join(BASE_DIR, 'assets', 'uploads');

// Đảm bảo các thư mục lưu trữ tồn tại
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

// Đọc JSON file an toàn
function readJson(filename, defaultVal = {}) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
      return defaultVal;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Lỗi đọc ${filename}:`, err);
    return defaultVal;
  }
}

// Ghi JSON file an toàn
function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Đọc body từ Request
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) { // Max 25MB (cho upload ảnh)
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body) return resolve({});
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

// Tạo HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const method = req.method.toUpperCase();

  // CORS Headers cho mọi request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ==========================================
  // 1. CÁC API ENDPOINTS LƯU TRỮ VĨNH VIỄN
  // ==========================================

  // --- API 1: TOÀN BỘ CẤU HÌNH & DỮ LIỆU ĐOÀN XÃ (/api/data) ---
  if (pathname === '/api/data') {
    if (method === 'GET') {
      const data = readJson('database.json');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
    if (method === 'POST') {
      try {
        const body = await getRequestBody(req);
        writeJson('database.json', body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Đã lưu dữ liệu vĩnh viễn vào máy chủ!' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // --- API 2: ĐĂNG KÝ TÌNH NGUYỆN (/api/volunteers) ---
  if (pathname === '/api/volunteers') {
    if (method === 'GET') {
      const list = readJson('volunteers.json', []);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
      return;
    }
    if (method === 'POST') {
      try {
        const item = await getRequestBody(req);
        item.id = 'VOL-' + Date.now();
        item.createdAt = new Date().toLocaleString('vi-VN');
        const list = readJson('volunteers.json', []);
        list.push(item);
        writeJson('volunteers.json', list);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // Xóa đăng ký tình nguyện
  if (pathname.startsWith('/api/volunteers/') && method === 'DELETE') {
    const id = pathname.replace('/api/volunteers/', '');
    let list = readJson('volunteers.json', []);
    list = list.filter(v => v.id !== id);
    writeJson('volunteers.json', list);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- API 3: HÒM THƯ HIẾN KẾ THANH NIÊN (/api/ideas) ---
  if (pathname === '/api/ideas') {
    if (method === 'GET') {
      const list = readJson('ideas.json', []);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
      return;
    }
    if (method === 'POST') {
      try {
        const item = await getRequestBody(req);
        item.id = 'IDEA-' + Date.now();
        item.createdAt = new Date().toLocaleDateString('vi-VN');
        item.status = item.status || 'Đã tiếp nhận';
        const list = readJson('ideas.json', []);
        list.push(item);
        writeJson('ideas.json', list);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // Cập nhật trạng thái hiến kế
  if (pathname.startsWith('/api/ideas/') && (method === 'PUT' || method === 'POST')) {
    const id = pathname.replace('/api/ideas/', '');
    const body = await getRequestBody(req);
    const list = readJson('ideas.json', []);
    const target = list.find(i => i.id === id);
    if (target) {
      if (body.status) target.status = body.status;
      writeJson('ideas.json', list);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- API 4: ĐIỂM DANH AI FACEID & QR (/api/checkin) ---
  if (pathname === '/api/checkin') {
    if (method === 'GET') {
      const roster = readJson('attendance.json', []);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(roster));
      return;
    }
    if (method === 'POST') {
      try {
        const body = await getRequestBody(req); // { id, name, hamlet }
        const roster = readJson('attendance.json', []);
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const searchKey = body.id || body.qrData || body.code;
        let found = roster.find(r => (searchKey && (r.id === searchKey || r.qrData === searchKey)) || (body.name && r.name.toLowerCase() === body.name.toLowerCase()));
        if (found) {
          found.checkedIn = true;
          found.checkinTime = timeStr;
          found.method = body.method || 'FaceID';
        } else if (body.name) {
          found = {
            id: 'HK-ADD-' + Date.now().toString().slice(-4),
            name: body.name,
            hamlet: body.hamlet || 'Ấp Thuận Hòa 1',
            role: body.role || 'Đại biểu thanh niên',
            avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
            qrData: 'HK-ADD-' + Date.now().toString().slice(-4),
            checkedIn: true,
            checkinTime: timeStr,
            method: body.method || 'FaceID'
          };
          roster.push(found);
        }
        writeJson('attendance.json', roster);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, delegate: found }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // Thêm hoặc cập nhật Đại biểu (kèm ảnh khuôn mặt & mã QR)
  if (pathname === '/api/checkin/delegate' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const roster = readJson('attendance.json', []);
      let index = roster.findIndex(r => r.id === body.id);
      if (index !== -1) {
        roster[index] = { ...roster[index], ...body };
      } else {
        const newId = body.id || ('HK-DB-' + (roster.length + 1).toString().padStart(2, '0'));
        const newDel = {
          id: newId,
          name: body.name,
          hamlet: body.hamlet || 'Ấp Thuận Hòa 1',
          role: body.role || 'Đại biểu thanh niên',
          avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
          qrData: body.qrData || newId,
          checkedIn: false,
          checkinTime: null
        };
        roster.push(newDel);
      }
      writeJson('attendance.json', roster);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, roster }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Xóa Đại biểu
  if (pathname.startsWith('/api/checkin/delegate/') && method === 'DELETE') {
    const delId = pathname.replace('/api/checkin/delegate/', '');
    let roster = readJson('attendance.json', []);
    roster = roster.filter(r => r.id !== delId);
    writeJson('attendance.json', roster);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, roster }));
    return;
  }

  // Reset điểm danh
  if (pathname === '/api/checkin/reset' && method === 'POST') {
    const roster = readJson('attendance.json', []);
    roster.forEach(r => {
      r.checkedIn = false;
      r.checkinTime = null;
    });
    writeJson('attendance.json', roster);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- API 5: TẢI ẢNH THẬT LÊN MÁY CHỦ (/api/upload) ---
  if (pathname === '/api/upload' && method === 'POST') {
    try {
      const body = await getRequestBody(req); // { filename, base64 }
      if (!body.base64) {
        throw new Error('Thiếu dữ liệu ảnh base64');
      }

      // Xử lý chuỗi Base64
      const matches = body.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = '.jpg';

      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
        if (matches[1].includes('png')) ext = '.png';
      } else {
        buffer = Buffer.from(body.base64, 'base64');
      }

      const safeName = `img_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      const savePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(savePath, buffer);

      const publicUrl = `assets/uploads/${safeName}`;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, url: publicUrl }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ==========================================
  // 2. PHỤC VỤ STATIC FILES (HTML, CSS, JS, IMAGES)
  // ==========================================
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(BASE_DIR, relativePath);

  // Bảo vệ không thoát ra ngoài BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(` CỔNG THÔNG TIN THANH NIÊN XÃ HÒA KHÁNH (TÂY NINH)`);
  console.log(` Máy chủ đang chạy ổn định tại: http://localhost:${PORT}`);
  console.log(` Trang Quản trị Admin:          http://localhost:${PORT}/admin.html`);
  console.log(` Cơ sở dữ liệu:                 ${DATA_DIR}`);
  console.log(`==================================================================`);
});
