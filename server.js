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

// Nodemailer & Gmail OTP System
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn("nodemailer chưa được cài đặt:", e);
}

// Bộ nhớ đệm OTP xác thực: email -> { otp, expiresAt, attempts }
const otpCache = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendGmailOtp(toEmail, otpCode, purpose = "Đăng ký tài khoản Đoàn viên") {
  const db = readJson('database.json', {});
  const smtpConfig = db.smtp || {};
  const senderEmail = process.env.GMAIL_USER || smtpConfig.senderEmail || (db.organization && db.organization.email) || 'doanxahoakhanh.tayninh@gmail.com';
  const appPassword = process.env.GMAIL_APP_PASSWORD || smtpConfig.appPassword || '';
  const senderName = smtpConfig.senderName || 'Đoàn Xã Hòa Khánh (Tây Ninh)';

  console.log(`[XÁC THỰC OTP GMAIL] Người nhận: ${toEmail} | Mã OTP: ${otpCode} | Mục đích: ${purpose}`);

  // Nếu đã cấu hình Mật khẩu ứng dụng Google (App Password): gửi email thực tế qua Gmail SMTP
  if (nodemailer && appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: senderEmail,
          pass: appPassword.replace(/\s+/g, '')
        }
      });

      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #005baa 0%, #003366 100%); padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">ĐOÀN TNCS HỒ CHÍ MINH XÃ HÒA KHÁNH</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #bae6fd;">CỔNG THÔNG TIN ĐIỆN TỬ & DỊCH VỤ SỐ ĐOÀN VIÊN</p>
          </div>
          <div style="padding: 28px 24px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 14px;">Kính gửi đồng chí,</p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px;">
              Đồng chí đang thực hiện <strong>${purpose}</strong>. Dưới đây là mã xác thực OTP bảo mật 06 chữ số của đồng chí:
            </p>
            <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 13px; color: #047857; font-weight: bold; display: block; margin-bottom: 6px;">MÃ XÁC THỰC BẢO MẬT (OTP)</span>
              <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #059669; font-family: monospace;">${otpCode}</div>
              <span style="font-size: 12px; color: #64748b; display: block; margin-top: 6px;">Mã có hiệu lực trong <strong>05 phút</strong></span>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
              ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu không phải đồng chí yêu cầu mã này, vui lòng bỏ qua thư này.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
            <strong>Đoàn TNCS Hồ Chí Minh Xã Hòa Khánh - Tỉnh Tây Ninh</strong><br>
            Hotline: ${db.organization?.phone || '0947463036'} | Email: ${senderEmail}<br>
            <span style="display: inline-block; margin-top: 6px; color: #0284c7; font-weight: 600;">💡 Hệ thống được nghiên cứu và phát triển bởi: <strong style="color: #b45309;">Lương Tấn Phát</strong></span>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: toEmail,
        subject: `[Đoàn Xã Hòa Khánh] Mã xác thực OTP đăng ký: ${otpCode}`,
        html: htmlContent
      });

      console.log(`✓ Đã gửi email thực tế thành công qua Gmail SMTP tới: ${toEmail}`);
      return { success: true, mode: 'smtp', message: 'Mã OTP đã được gửi đến hộp thư Gmail của đồng chí!' };
    } catch (err) {
      console.warn("Lỗi gửi Gmail SMTP:", err.message);
      return {
        success: true,
        mode: 'fallback',
        message: 'Đã phát hành mã OTP bảo mật Gmail!',
        debugOtp: otpCode,
        error: err.message
      };
    }
  }

  // Môi trường thử nghiệm / chưa cấu hình App Password: trả về mã OTP rõ ràng
  return {
    success: true,
    mode: 'simulation',
    message: 'Đã phát hành mã OTP xác thực Gmail!',
    debugOtp: otpCode
  };
}

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

  // --- API 0: XÁC THỰC TÀI KHOẢN & ĐĂNG NHẬP / ĐĂNG KÝ (/api/auth) ---
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const username = (body.username || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      const users = readJson('users.json', []);
      const user = users.find(u => u.username.toLowerCase() === username && u.password === password);

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' }));
        return;
      }

      const token = 'SEC-' + Buffer.from(user.username + ':' + Date.now() + ':' + user.role).toString('base64');
      const safeUser = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        hamlet: user.hamlet,
        phone: user.phone
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, token, user: safeUser, message: 'Đăng nhập thành công!' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  // --- API 0.1: GỬI MÃ OTP QUA GMAIL (/api/auth/send-otp) ---
  if (pathname === '/api/auth/send-otp' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const fullName = (body.fullName || 'Đồng chí Đoàn viên').trim();
      const purpose = body.purpose || 'Đăng ký tài khoản Đoàn viên';

      // Kiểm tra định dạng email
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Địa chỉ Gmail không hợp lệ. Vui lòng kiểm tra lại!' }));
        return;
      }

      // Kiểm tra xem email đã được đăng ký tài khoản trước đó chưa
      const users = readJson('users.json', []);
      if (body.type === 'register' && users.some(u => (u.email || '').toLowerCase() === email)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Địa chỉ Gmail này đã được đăng ký cho một tài khoản khác!' }));
        return;
      }

      // Kiểm tra tần suất gửi (chống spam - tối thiểu 30 giây mới được gửi lại)
      const existing = otpCache.get(email);
      if (existing && (Date.now() - existing.createdAt < 30 * 1000)) {
        const waitSec = Math.ceil((30 * 1000 - (Date.now() - existing.createdAt)) / 1000);
        res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: `Vui lòng đợi ${waitSec} giây trước khi yêu cầu gửi lại mã OTP!` }));
        return;
      }

      // Sinh mã OTP 6 chữ số
      const otpCode = generateOtp();
      otpCache.set(email, {
        otp: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // Hiệu lực 5 phút
        createdAt: Date.now(),
        attempts: 0
      });

      // Gửi email qua Gmail
      const sendResult = await sendGmailOtp(email, otpCode, purpose);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        message: sendResult.mode === 'smtp'
          ? `Mã OTP đã được gửi đến hộp thư Gmail (${email})! Vui lòng kiểm tra Hộp thư đến (hoặc thư Rác/Spam).`
          : `Đã phát hành mã OTP bảo mật cho Gmail (${email})!`,
        mode: sendResult.mode,
        debugOtp: sendResult.debugOtp, // Phục vụ hiển thị hỗ trợ nếu chưa gắn App Password
        expiresInSeconds: 300
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  // --- API 0.2: ĐĂNG KÝ TÀI KHOẢN ĐOÀN VIÊN (BẮT BUỘC XÁC THỰC MÃ OTP TỪ GMAIL) ---
  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const fullName = (body.fullName || '').trim();
      const phone = (body.phone || body.username || '').trim();
      const username = (body.username || phone).trim().toLowerCase();
      const password = (body.password || '').trim();
      const email = (body.email || '').trim().toLowerCase();
      const otp = (body.otp || '').trim();
      const hamlet = body.hamlet || 'Ấp Thuận Hòa 1';

      if (!fullName || !username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu!' }));
        return;
      }

      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Vui lòng cung cấp địa chỉ Gmail để nhận mã xác thực bảo mật OTP!' }));
        return;
      }

      if (!otp) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Vui lòng nhập mã OTP 6 chữ số nhận từ Gmail!' }));
        return;
      }

      // XÁC THỰC MÃ OTP BẢO MẬT
      const cached = otpCache.get(email);
      if (!cached) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Chưa có mã OTP nào được gửi đến Gmail này hoặc mã đã hết hạn. Vui lòng bấm "Lấy mã OTP qua Gmail"!' }));
        return;
      }

      if (Date.now() > cached.expiresAt) {
        otpCache.delete(email);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Mã OTP đã hết hạn sau 05 phút. Vui lòng bấm gửi lại mã OTP mới!' }));
        return;
      }

      if (cached.otp !== otp) {
        cached.attempts = (cached.attempts || 0) + 1;
        if (cached.attempts >= 5) {
          otpCache.delete(email);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: 'Nhập sai mã OTP quá 5 lần. Mã OTP đã bị hủy để bảo vệ tài khoản, vui lòng lấy mã mới!' }));
          return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: `Mã OTP xác thực không chính xác! (Còn ${5 - cached.attempts} lần thử)` }));
        return;
      }

      // Xác thực OTP thành công -> Hủy mã trong cache để không dùng lại
      otpCache.delete(email);

      // Kiểm tra trùng tài khoản
      const users = readJson('users.json', []);
      if (users.some(u => u.username.toLowerCase() === username)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Số điện thoại / Tên đăng nhập này đã có người đăng ký!' }));
        return;
      }
      if (users.some(u => (u.email || '').toLowerCase() === email)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Địa chỉ Gmail này đã được sử dụng cho một tài khoản khác!' }));
        return;
      }

      const newUser = {
        id: 'USR-' + Date.now(),
        username: username,
        password: password,
        fullName: fullName,
        role: 'member',
        hamlet: hamlet,
        phone: phone,
        email: email,
        isEmailVerified: true,
        verifiedAt: new Date().toLocaleString('vi-VN'),
        createdAt: new Date().toLocaleString('vi-VN')
      };

      users.push(newUser);
      writeJson('users.json', users);

      const token = 'SEC-' + Buffer.from(newUser.username + ':' + Date.now() + ':member').toString('base64');
      const safeUser = {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: 'member',
        hamlet: newUser.hamlet,
        phone: newUser.phone,
        email: newUser.email,
        isEmailVerified: true
      };

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        token,
        user: safeUser,
        message: 'Đăng ký tài khoản Đoàn viên và xác thực Gmail OTP thành công!'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (pathname === '/api/auth/users' && method === 'GET') {
    const users = readJson('users.json', []);
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      hamlet: u.hamlet,
      phone: u.phone,
      email: u.email || 'Chưa liên kết',
      isEmailVerified: !!u.isEmailVerified,
      createdAt: u.createdAt
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(safeUsers));
    return;
  }

  // --- API 0.3: LẤY CẤU HÌNH GMAIL SMTP OTP (/api/smtp/config) ---
  if (pathname === '/api/smtp/config' && method === 'GET') {
    const db = readJson('database.json', {});
    const smtp = db.smtp || {};
    const configured = !!(process.env.GMAIL_APP_PASSWORD || smtp.appPassword);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      senderEmail: process.env.GMAIL_USER || smtp.senderEmail || (db.organization && db.organization.email) || 'doanxahoakhanh.tayninh@gmail.com',
      senderName: smtp.senderName || 'Đoàn Xã Hòa Khánh (Tây Ninh)',
      hasAppPassword: configured,
      maskedPassword: configured ? '••••••••••••••••' : '',
      nodemailerReady: !!nodemailer
    }));
    return;
  }

  // --- API 0.4: LƯU CẤU HÌNH GMAIL SMTP OTP (/api/smtp/config) ---
  if (pathname === '/api/smtp/config' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const db = readJson('database.json', {});
      db.smtp = db.smtp || {};

      if (body.senderEmail) db.smtp.senderEmail = body.senderEmail.trim();
      if (body.senderName) db.smtp.senderName = body.senderName.trim();
      if (body.appPassword !== undefined) {
        // Nếu người dùng nhập chuỗi mới (không phải chuỗi mask) thì lưu
        const pwd = body.appPassword.replace(/\s+/g, '').trim();
        if (pwd && !pwd.includes('•')) {
          db.smtp.appPassword = pwd;
        }
      }

      writeJson('database.json', db);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Đã lưu cấu hình gửi mã OTP Gmail thành công!' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  // --- API 0.5: KIỂM TRA GỬI EMAIL THỰC TẾ (/api/smtp/test) ---
  if (pathname === '/api/smtp/test' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const testEmail = (body.email || '').trim().toLowerCase();
      if (!testEmail || !testEmail.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Vui lòng nhập địa chỉ Gmail nhận thử nghiệm hợp lệ!' }));
        return;
      }

      const testOtp = generateOtp();
      const testResult = await sendGmailOtp(testEmail, testOtp, 'Kiểm tra kết nối gửi thư OTP Đoàn xã Hòa Khánh');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        message: testResult.mode === 'smtp'
          ? `Gửi email thử nghiệm thành công tới ${testEmail}! Vui lòng kiểm tra hộp thư.`
          : `Đã thử nghiệm ở chế độ mô phỏng (Chưa lưu App Password hợp lệ)! Mã test: ${testOtp}`,
        mode: testResult.mode,
        debugOtp: testResult.debugOtp
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

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
