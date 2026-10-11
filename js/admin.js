/**
 * JAVASCRIPT ĐIỀU KHIỂN BẢNG QUẢN TRỊ ADMIN CMS - ĐOÀN XÃ HÒA KHÁNH (TÂY NINH)
 */

let appDatabase = null;
let volunteerList = [];
let ideasList = [];
let attendanceList = [];

// Toast Notification
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : '⚡';
  toast.innerHTML = `<span>${icon}</span> <div>${msg}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Chuyển Tab
window.switchAdminTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  const targetBtn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);

  if (targetTab) targetTab.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  const titles = {
    'tab-overview': 'Tổng quan số liệu',
    'tab-org': 'Thông tin Đoàn xã',
    'tab-youth': '09 Gương thanh niên tiêu biểu 09 ấp',
    'tab-volunteers': 'Đăng ký tình nguyện',
    'tab-ideas': 'Hòm thư hiến kế',
    'tab-attendance': 'Quản lý điểm danh AI FaceID',
    'tab-smtp': 'Cấu hình Gmail OTP Bảo Mật',
    'tab-users': 'Danh sách Đoàn viên đã đăng ký'
  };
  const titleEl = document.getElementById('admin-page-title');
  if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];
};

document.addEventListener('DOMContentLoaded', () => {
  initAdminGateAuth();
  const isAuth = checkAdminAuth();

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchAdminTab(tabId);
    });
  });

  const btnSync = document.getElementById('btn-sync-refresh');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      loadAllData();
      loadSmtpConfig();
      loadUsersList();
      showToast('Đang tải và đồng bộ lại toàn bộ dữ liệu...', 'success');
    });
  }

  if (isAuth) {
    loadAllData();
  }

  initOrgForm();
  initYouthEditForm();
  initVolunteerActions();
  initAttendanceActions();
  initSmtpSettings();
  initUsersManagement();
});

function checkAdminAuth() {
  const gate = document.getElementById('admin-auth-gate');
  const token = localStorage.getItem('hoakhanh_admin_token');
  const userJson = localStorage.getItem('hoakhanh_admin_user');

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user.role === 'admin') {
        if (gate) gate.style.display = 'none';
        const nameEl = document.getElementById('sidebar-admin-name');
        if (nameEl) nameEl.textContent = user.fullName || user.username;
        return true;
      }
    } catch (e) {}
  }

  // Nếu chưa đăng nhập: Hiển thị Auth Gate bảo vệ nghiêm ngặt
  if (gate) gate.style.display = 'flex';
  return false;
}

function initAdminGateAuth() {
  const formGate = document.getElementById('form-gate-admin-login');
  if (formGate) {
    formGate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('gate-admin-username').value.trim();
      const password = document.getElementById('gate-admin-password').value.trim();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }).then(r => r.json());

        if (res.success && res.user.role === 'admin') {
          localStorage.setItem('hoakhanh_admin_token', res.token);
          localStorage.setItem('hoakhanh_admin_user', JSON.stringify(res.user));
          const gate = document.getElementById('admin-auth-gate');
          if (gate) gate.style.display = 'none';
          const nameEl = document.getElementById('sidebar-admin-name');
          if (nameEl) nameEl.textContent = res.user.fullName || res.user.username;
          showToast(`Đăng nhập thành công! Chào mừng ${res.user.fullName}`, 'success');
          loadAllData();
        } else {
          showToast(res.message || 'Tài khoản không có quyền quản trị hoặc sai mật khẩu!', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    });
  }

  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Đồng chí có chắc chắn muốn đăng xuất khỏi Bảng điều khiển Quản trị?')) {
        localStorage.removeItem('hoakhanh_admin_token');
        localStorage.removeItem('hoakhanh_admin_user');
        const gate = document.getElementById('admin-auth-gate');
        if (gate) gate.style.display = 'flex';
        showToast('Đã đăng xuất tài khoản quản trị!', 'info');
      }
    });
  }
}

async function loadAllData() {
  try {
    const [resData, resVol, resIdeas, resAtt] = await Promise.all([
      fetch('/api/data').then(r => r.json()),
      fetch('/api/volunteers').then(r => r.json()),
      fetch('/api/ideas').then(r => r.json()),
      fetch('/api/checkin').then(r => r.json())
    ]);

    appDatabase = resData;
    volunteerList = resVol;
    ideasList = resIdeas;
    attendanceList = resAtt;

    renderOverview();
    renderOrgSettings();
    renderYouthTable();
    renderVolunteersTable();
    renderIdeasTable();
    renderAttendanceTable();
  } catch (err) {
    console.error('Lỗi tải dữ liệu:', err);
    showToast('Lỗi kết nối máy chủ!', 'warning');
  }
}

/* 1. TỔNG QUAN */
function renderOverview() {
  document.getElementById('stat-ov-volunteers').textContent = volunteerList.length;
  document.getElementById('stat-ov-ideas').textContent = ideasList.length;

  const checkedCount = attendanceList.filter(a => a.checkedIn).length;
  document.getElementById('stat-ov-checkedin').textContent = `${checkedCount} / ${attendanceList.length}`;

  document.getElementById('badge-vol-count').textContent = volunteerList.length;
  document.getElementById('badge-idea-count').textContent = ideasList.length;
}

/* 2. THÔNG TIN ĐOÀN XÃ */
function renderOrgSettings() {
  if (!appDatabase || !appDatabase.organization) return;
  const org = appDatabase.organization;
  document.getElementById('org-name').value = org.name || '';
  document.getElementById('org-slogan').value = org.slogan || '';
  document.getElementById('org-address').value = org.address || '';
  document.getElementById('org-phone').value = org.phone || '';
  document.getElementById('org-email').value = org.email || '';
  document.getElementById('org-fanpage').value = org.fanpage || '';
  document.getElementById('org-zalo').value = org.zalo || '';
}

function initOrgForm() {
  const form = document.getElementById('form-org-settings');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!appDatabase) return;

    appDatabase.organization.name = document.getElementById('org-name').value;
    appDatabase.organization.slogan = document.getElementById('org-slogan').value;
    appDatabase.organization.address = document.getElementById('org-address').value;
    appDatabase.organization.phone = document.getElementById('org-phone').value;
    appDatabase.organization.email = document.getElementById('org-email').value;
    appDatabase.organization.fanpage = document.getElementById('org-fanpage').value;
    appDatabase.organization.zalo = document.getElementById('org-zalo').value;

    const res = await saveDatabase();
    if (res.success) {
      showToast('Đã lưu thông tin Đoàn xã thành công!', 'success');
    }
  });
}

/* 3. 09 GƯƠNG THANH NIÊN TIÊU BIỂU 09 ẤP */
function renderYouthTable() {
  const tbody = document.getElementById('table-youth-tbody');
  tbody.innerHTML = '';
  if (!appDatabase || !appDatabase.outstandingYouth) return;

  appDatabase.outstandingYouth.forEach(youth => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <img src="${youth.avatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--admin-cyan);">
      </td>
      <td><strong>${youth.name}</strong><br><small style="color:var(--admin-muted);">${youth.role}</small></td>
      <td><span class="status-pill status-green">${youth.hamlet}</span></td>
      <td><span style="color: var(--admin-gold); font-weight: 600;">${youth.badge}</span></td>
      <td>❤️ ${youth.likes}</td>
      <td>
        <button class="action-btn action-btn-primary btn-edit-youth" data-id="${youth.id}">
          ✏️ Chỉnh sửa hồ sơ
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-edit-youth').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const found = appDatabase.outstandingYouth.find(y => y.id === id);
      if (found) openYouthModal(found);
    });
  });
}

function openYouthModal(youth) {
  document.getElementById('edit-youth-id').value = youth.id;
  document.getElementById('edit-youth-name').value = youth.name;
  document.getElementById('edit-youth-hamlet').value = youth.hamlet;
  document.getElementById('edit-youth-role').value = youth.role;
  document.getElementById('edit-youth-year').value = youth.yearOfBirth;
  document.getElementById('edit-youth-badge').value = youth.badge;
  document.getElementById('edit-youth-avatar-url').value = youth.avatar;
  document.getElementById('edit-youth-img-preview').src = youth.avatar;
  document.getElementById('edit-youth-achievement').value = youth.achievement;
  document.getElementById('edit-youth-quote').value = youth.quote;

  document.getElementById('modal-edit-youth').classList.add('open');
}

function initYouthEditForm() {
  const fileInput = document.getElementById('edit-youth-file-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const base64 = await toBase64(file);
    document.getElementById('edit-youth-img-preview').src = base64;

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, base64 })
    }).then(r => r.json());

    if (uploadRes.success) {
      document.getElementById('edit-youth-avatar-url').value = uploadRes.url;
      showToast('Đã tải ảnh lên máy chủ thành công!', 'success');
    }
  });

  const form = document.getElementById('form-edit-youth');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-youth-id').value;
    const found = appDatabase.outstandingYouth.find(y => y.id === id);
    if (!found) return;

    found.name = document.getElementById('edit-youth-name').value;
    found.hamlet = document.getElementById('edit-youth-hamlet').value;
    found.role = document.getElementById('edit-youth-role').value;
    found.yearOfBirth = parseInt(document.getElementById('edit-youth-year').value);
    found.badge = document.getElementById('edit-youth-badge').value;
    found.avatar = document.getElementById('edit-youth-avatar-url').value;
    found.achievement = document.getElementById('edit-youth-achievement').value;
    found.quote = document.getElementById('edit-youth-quote').value;

    await saveDatabase();
    document.getElementById('modal-edit-youth').classList.remove('open');
    renderYouthTable();
    showToast(`Đã cập nhật hồ sơ đồng chí ${found.name} (${found.hamlet})!`, 'success');
  });
}

/* 4. QUẢN LÝ ĐĂNG KÝ TÌNH NGUYỆN */
function renderVolunteersTable() {
  const tbody = document.getElementById('table-volunteers-tbody');
  tbody.innerHTML = '';

  if (volunteerList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 25px; color: var(--admin-muted);">Chưa có đơn đăng ký nào.</td></tr>';
    return;
  }

  [...volunteerList].reverse().forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${v.name}</strong></td>
      <td><a href="tel:${v.phone}" style="color:var(--admin-cyan);">${v.phone}</a></td>
      <td><span class="status-pill status-green">${v.hamlet}</span></td>
      <td><span style="color:#e2e8f0;">${v.squad}</span></td>
      <td><small style="color:var(--admin-muted);">${v.skill || 'Không ghi chú'}</small></td>
      <td><small>${v.createdAt || '--'}</small></td>
      <td>
        <button class="action-btn action-btn-danger btn-del-vol" data-id="${v.id}">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-del-vol').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Xóa thông tin tình nguyện viên này?')) {
        await fetch(`/api/volunteers/${id}`, { method: 'DELETE' });
        volunteerList = volunteerList.filter(v => v.id !== id);
        renderVolunteersTable();
        renderOverview();
        showToast('Đã xóa tình nguyện viên!', 'success');
      }
    });
  });
}

function initVolunteerActions() {
  document.getElementById('btn-export-vol-csv').addEventListener('click', () => {
    let csvContent = "\uFEFFMã TNV,Họ và Tên,Số điện thoại,Địa bàn ấp,Đội hình đăng ký,Kỹ năng sở trường,Thời gian đăng ký\n";
    volunteerList.forEach(v => {
      csvContent += `"${v.id}","${v.name}","${v.phone}","${v.hamlet}","${v.squad}","${v.skill || ''}","${v.createdAt || ''}"\n`;
    });
    downloadCsv(csvContent, `Danh_Sach_Tinh_Nguyen_Vien_Hoa_Khanh_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
  });
}

/* 5. HÒM THƯ HIẾN KẾ */
function renderIdeasTable() {
  const tbody = document.getElementById('table-ideas-tbody');
  tbody.innerHTML = '';

  if (ideasList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 25px; color: var(--admin-muted);">Chưa có ý tưởng hiến kế nào.</td></tr>';
    return;
  }

  [...ideasList].reverse().forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${i.author}</strong></td>
      <td><span class="status-pill status-green">${i.hamlet}</span></td>
      <td><strong>${i.title}</strong><br><small style="color:var(--admin-muted);">${i.createdAt}</small></td>
      <td><span style="color:var(--admin-cyan);">${i.topic}</span></td>
      <td style="max-width: 320px; font-size: 0.82rem;">${i.content}</td>
      <td>
        <select class="form-select select-idea-status" data-id="${i.id}" style="padding: 4px 8px; font-size: 0.78rem;">
          <option value="Đã tiếp nhận" ${i.status === 'Đã tiếp nhận' ? 'selected' : ''}>Đã tiếp nhận</option>
          <option value="Đang nghiên cứu" ${i.status === 'Đang nghiên cứu' ? 'selected' : ''}>Đang nghiên cứu</option>
          <option value="Đã duyệt triển khai" ${i.status === 'Đã duyệt triển khai' ? 'selected' : ''}>Đã duyệt triển khai</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.select-idea-status').forEach(select => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-id');
      const status = select.value;
      await fetch(`/api/ideas/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      showToast(`Đã cập nhật trạng thái hiến kế: ${status}`, 'success');
    });
  });
}

/* 6. QUẢN LÝ ĐIỂM DANH AI FACEID & MÃ QR CÁ NHÂN */
let currentBadgeDelegate = null;
let delWebcamStream = null;

function renderAttendanceTable() {
  const tbody = document.getElementById('table-attendance-tbody');
  tbody.innerHTML = '';

  attendanceList.forEach(a => {
    const tr = document.createElement('tr');
    tr.id = `row-att-${a.id}`;
    const avatarSrc = a.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
    const qrText = a.qrData || a.id;

    tr.innerHTML = `
      <td style="text-align: center;">
        <div class="table-avatar-cell btn-change-face" data-id="${a.id}" title="Bấm để đổi ảnh / chụp khuôn mặt">
          <img src="${avatarSrc}" class="table-face-avatar" alt="${a.name}">
          <span class="table-face-cam-badge">📷</span>
        </div>
      </td>
      <td><code>${a.id}</code></td>
      <td><strong>${a.name}</strong></td>
      <td><span class="status-pill status-green">${a.hamlet}</span></td>
      <td>${a.role}</td>
      <td style="text-align: center;">
        <div class="table-qr-thumb-box btn-show-badge" data-id="${a.id}" id="qr-thumb-${a.id}" title="Bấm xem Thẻ QR đại biểu"></div>
      </td>
      <td>
        <span class="status-pill ${a.checkedIn ? 'status-green' : 'status-gold'}">
          ${a.checkedIn ? '✓ Đã có mặt' : 'Chưa điểm danh'}
        </span>
      </td>
      <td>${a.checkinTime || '--:--:--'}</td>
      <td style="text-align: center;">
        <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
          <button class="action-btn action-btn-primary btn-show-badge" data-id="${a.id}" title="Xem & In Thẻ Đại biểu">
            🪪 Thẻ QR
          </button>
          <button class="action-btn btn-success btn-toggle-att" data-id="${a.id}" title="Điểm danh nhanh">
            ${a.checkedIn ? 'Hủy' : '✓ Mặt'}
          </button>
          <button class="action-btn action-btn-info btn-edit-del" data-id="${a.id}" title="Chỉnh sửa hồ sơ">
            ✏️
          </button>
          <button class="action-btn action-btn-danger btn-delete-del" data-id="${a.id}" title="Xóa đại biểu">
            🗑️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Sinh mã QR thu nhỏ ngay trong hàng
    try {
      const container = document.getElementById(`qr-thumb-${a.id}`);
      if (container && window.QRCode) {
        new QRCode(container, {
          text: qrText,
          width: 40,
          height: 40,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (e) {
      console.warn("Lỗi sinh QR thumbnail:", e);
    }
  });

  // Gán sự kiện Thẻ QR
  tbody.querySelectorAll('.btn-show-badge').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const del = attendanceList.find(d => d.id === id);
      if (del) openBadgeModal(del);
    });
  });

  // Gán sự kiện đổi ảnh / chụp khuôn mặt
  tbody.querySelectorAll('.btn-change-face, .btn-edit-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const del = attendanceList.find(d => d.id === id);
      if (del) openDelegateModal(del);
    });
  });

  // Điểm danh nhanh thủ công
  tbody.querySelectorAll('.btn-toggle-att').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const del = attendanceList.find(d => d.id === id);
      if (!del) return;

      if (!del.checkedIn) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        del.checkedIn = true;
        del.checkinTime = timeStr;
        await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: del.id, method: 'Thủ công' })
        });
        showToast(`Đã điểm danh cho đồng chí ${del.name}!`, 'success');
      } else {
        del.checkedIn = false;
        del.checkinTime = null;
        await fetch('/api/checkin/delegate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(del)
        });
        showToast(`Đã hủy điểm danh của đồng chí ${del.name}!`, 'info');
      }
      renderAttendanceTable();
      renderOverview();
    });
  });

  // Xóa đại biểu
  tbody.querySelectorAll('.btn-delete-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const del = attendanceList.find(d => d.id === id);
      if (!del) return;
      if (confirm(`Đồng chí có chắc chắn muốn xóa đại biểu "${del.name}" (${del.id}) khỏi danh sách triệu tập?`)) {
        await fetch(`/api/checkin/delegate/${id}`, { method: 'DELETE' });
        attendanceList = attendanceList.filter(d => d.id !== id);
        renderAttendanceTable();
        renderOverview();
        showToast(`Đã xóa đại biểu ${del.name}!`, 'success');
      }
    });
  });
}

function openDelegateModal(delegate = null) {
  const modal = document.getElementById('modal-delegate-form');
  const title = document.getElementById('delegate-modal-title');
  const idInput = document.getElementById('del-id');
  const codeInput = document.getElementById('del-code');
  const nameInput = document.getElementById('del-name');
  const hamletSelect = document.getElementById('del-hamlet');
  const roleInput = document.getElementById('del-role');
  const avatarPreview = document.getElementById('del-avatar-preview');
  const avatarVal = document.getElementById('del-avatar-val');

  closeDelWebcam();

  if (delegate) {
    title.textContent = `Chỉnh Sửa Đại Biểu & Khuôn Mặt: ${delegate.name}`;
    idInput.value = delegate.id;
    codeInput.value = delegate.id;
    codeInput.readOnly = true;
    nameInput.value = delegate.name;
    hamletSelect.value = delegate.hamlet;
    roleInput.value = delegate.role;
    avatarVal.value = delegate.avatar || '';
    avatarPreview.src = delegate.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
  } else {
    title.textContent = "Đăng Ký Đại Biểu Mới & Cấp Mã QR";
    const nextNum = (attendanceList.length + 1).toString().padStart(2, '0');
    idInput.value = '';
    codeInput.value = `HK-DB-${nextNum}`;
    codeInput.readOnly = false;
    nameInput.value = '';
    hamletSelect.value = 'Ấp Thuận Hòa 1';
    roleInput.value = 'Đại biểu thanh niên';
    const defaultAvt = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
    avatarVal.value = defaultAvt;
    avatarPreview.src = defaultAvt;
  }

  modal.classList.add('open');
}

window.closeDelegateModal = function() {
  const modal = document.getElementById('modal-delegate-form');
  if (modal) modal.classList.remove('open');
  closeDelWebcam();
};

async function startDelWebcam() {
  const container = document.getElementById('del-webcam-container');
  const video = document.getElementById('del-webcam-video');
  if (!container || !video) return;

  try {
    delWebcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = delWebcamStream;
    container.style.display = 'block';
  } catch (err) {
    alert("Không thể mở Webcam để chụp khuôn mặt: " + err.message);
  }
}

function closeDelWebcam() {
  if (delWebcamStream) {
    delWebcamStream.getTracks().forEach(track => track.stop());
    delWebcamStream = null;
  }
  const video = document.getElementById('del-webcam-video');
  if (video) video.srcObject = null;
  const container = document.getElementById('del-webcam-container');
  if (container) container.style.display = 'none';
}

function captureDelPhoto() {
  const video = document.getElementById('del-webcam-video');
  if (!video || !video.videoWidth) return;

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // Crop tâm thành hình vuông chuẩn khuôn mặt
  const size = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

  const base64 = canvas.toDataURL('image/jpeg', 0.9);
  document.getElementById('del-avatar-preview').src = base64;
  document.getElementById('del-avatar-val').value = base64;

  closeDelWebcam();
  showToast('Đã chụp ảnh khuôn mặt thành công!', 'success');
}

function openBadgeModal(delegate) {
  currentBadgeDelegate = delegate;
  const modal = document.getElementById('modal-delegate-qr-card');
  if (!modal) return;

  const avatarSrc = delegate.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
  document.getElementById('badge-photo').src = avatarSrc;
  document.getElementById('badge-name').textContent = delegate.name.toUpperCase();
  document.getElementById('badge-role-hamlet').textContent = `${delegate.role} • ${delegate.hamlet}`;
  document.getElementById('badge-code-label').textContent = delegate.id;

  // Render QR Code kích thước lớn
  const qrBox = document.getElementById('badge-qrcode-display');
  qrBox.innerHTML = '';
  if (window.QRCode) {
    new QRCode(qrBox, {
      text: delegate.qrData || delegate.id,
      width: 140,
      height: 140,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  modal.classList.add('open');
}

// Tải thẻ đại biểu ra file ảnh PNG chất lượng cao
function downloadBadgePNG() {
  if (!currentBadgeDelegate) return;
  const del = currentBadgeDelegate;

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 920;
  const ctx = canvas.getContext('2d');

  // Nền thẻ gradient sang trọng
  const grad = ctx.createLinearGradient(0, 0, 600, 920);
  grad.addColorStop(0, '#071933');
  grad.addColorStop(1, '#0c254a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 920);

  // Viền ngoài
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 580, 900);

  // Header đỏ cờ
  const headerGrad = ctx.createLinearGradient(0, 0, 600, 160);
  headerGrad.addColorStop(0, '#da251d');
  headerGrad.addColorStop(1, '#b91c1c');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(10, 10, 580, 150);

  // Logo Đoàn
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.src = 'assets/images/logo.png';

  logo.onload = () => {
    ctx.drawImage(logo, 30, 25, 90, 100);

    // Tiêu đề header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    ctx.fillText('ĐOÀN TNCS HỒ CHÍ MINH XÃ HÒA KHÁNH', 135, 65);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 15px Inter, Arial, sans-serif';
    ctx.fillText('ĐẠI BIỂU HỘI NGHỊ / ĐẠI HỘI ĐOÀN', 135, 100);

    // Ảnh đại biểu
    const avatar = new Image();
    avatar.crossOrigin = 'anonymous';
    avatar.src = del.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';

    avatar.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(300, 280, 80, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 220, 200, 160, 160);
      ctx.restore();

      // Viền ảnh
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(300, 280, 82, 0, Math.PI * 2);
      ctx.stroke();

      // Họ tên
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(del.name.toUpperCase(), 300, 410);

      // Chức vụ & Ấp
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 20px Inter, Arial, sans-serif';
      ctx.fillText(`${del.role} • ${del.hamlet}`, 300, 445);

      // Khung nền QR
      ctx.fillStyle = '#ffffff';
      ctx.roundRect ? ctx.roundRect(175, 480, 250, 250, 16) : ctx.fillRect(175, 480, 250, 250);
      ctx.fill();

      // Lấy ảnh QR từ modal
      const qrCanvas = document.querySelector('#badge-qrcode-display canvas') || document.querySelector('#badge-qrcode-display img');
      if (qrCanvas) {
        ctx.drawImage(qrCanvas, 195, 500, 210, 210);
      }

      // Mã số định danh
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`MÃ ĐB: ${del.id}`, 300, 775);

      // Ghi chú an toàn
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px Inter, Arial, sans-serif';
      ctx.fillText('✓ THẺ ĐẠI BIỂU ĐIỆN TỬ • QUÉT TẠI CỔNG ĐÓN TIẾP', 300, 820);

      // Chân thẻ
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, Arial, sans-serif';
      ctx.fillText('XÃ HÒA KHÁNH - TỈNH TÂY NINH', 300, 875);

      // Tải về
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `The_Dai_Bieu_${del.id}_${del.name.replace(/\s+/g, '_')}.png`;
      a.click();
      showToast(`Đã tải Thẻ đại biểu của ${del.name} thành công!`, 'success');
    };
    avatar.onerror = () => {
      showToast('Lỗi tải ảnh đại biểu để xuất thẻ!', 'warning');
    };
  };
}

function initAttendanceActions() {
  // Nút mở modal thêm đại biểu mới
  const btnAdd = document.getElementById('btn-add-delegate-modal');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => openDelegateModal(null));
  }

  // Chụp webcam trong modal đại biểu
  const btnToggleCam = document.getElementById('btn-toggle-del-webcam');
  if (btnToggleCam) btnToggleCam.addEventListener('click', startDelWebcam);

  const btnCaptureCam = document.getElementById('btn-capture-del-photo');
  if (btnCaptureCam) btnCaptureCam.addEventListener('click', captureDelPhoto);

  const btnCloseCam = document.getElementById('btn-close-del-webcam');
  if (btnCloseCam) btnCloseCam.addEventListener('click', closeDelWebcam);

  // File upload ảnh khuôn mặt trong modal đại biểu
  const fileInput = document.getElementById('del-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const base64 = await toBase64(file);
      document.getElementById('del-avatar-preview').src = base64;

      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 })
        }).then(r => r.json());

        if (uploadRes.success) {
          document.getElementById('del-avatar-val').value = uploadRes.url;
          showToast('Đã tải ảnh khuôn mặt lên máy chủ!', 'success');
        } else {
          document.getElementById('del-avatar-val').value = base64;
        }
      } catch (err) {
        document.getElementById('del-avatar-val').value = base64;
      }
    });
  }

  // Submit form đại biểu
  const formDel = document.getElementById('form-delegate-manage');
  if (formDel) {
    formDel.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('del-code').value.trim();
      const name = document.getElementById('del-name').value.trim();
      const hamlet = document.getElementById('del-hamlet').value;
      const role = document.getElementById('del-role').value.trim();
      const avatar = document.getElementById('del-avatar-val').value || document.getElementById('del-avatar-preview').src;

      if (!name) return;

      const delegateData = {
        id: code,
        name: name,
        hamlet: hamlet,
        role: role,
        avatar: avatar,
        qrData: code
      };

      try {
        const res = await fetch('/api/checkin/delegate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(delegateData)
        }).then(r => r.json());

        if (res.success) {
          showToast(`Đã lưu đại biểu ${name} và cấp mã QR thành công!`, 'success');
          closeDelegateModal();
          await loadAllData();
        } else {
          showToast('Lỗi lưu đại biểu!', 'warning');
        }
      } catch (err) {
        console.error(err);
        showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    });
  }

  // Tải thẻ đại biểu PNG
  const btnDl = document.getElementById('btn-download-badge-png');
  if (btnDl) btnDl.addEventListener('click', downloadBadgePNG);

  // In thẻ
  const btnPrint = document.getElementById('btn-print-badge');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // Quét thử mã QR này
  const btnQuick = document.getElementById('btn-quick-test-checkin');
  if (btnQuick) {
    btnQuick.addEventListener('click', async () => {
      if (!currentBadgeDelegate) return;
      const del = currentBadgeDelegate;
      await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: del.id, method: 'QR-Code' })
      });
      showToast(`⚡ Đã xác thực thành công mã QR của ${del.name}!`, 'success');
      document.getElementById('modal-delegate-qr-card').classList.remove('open');
      await loadAllData();
    });
  }

  // Nút reset điểm danh
  document.getElementById('btn-reset-att-admin').addEventListener('click', async () => {
    if (confirm('Đồng chí có chắc chắn muốn đặt lại toàn bộ trạng thái điểm danh về ban đầu?')) {
      await fetch('/api/checkin/reset', { method: 'POST' });
      attendanceList.forEach(a => { a.checkedIn = false; a.checkinTime = null; });
      renderAttendanceTable();
      renderOverview();
      showToast('Đã thiết lập lại điểm danh!', 'success');
    }
  });

  // Nút xuất CSV
  document.getElementById('btn-export-att-admin').addEventListener('click', () => {
    let csvContent = "\uFEFFMã ĐB,Họ và Tên,Đơn vị (Ấp),Chức vụ,Mã QR,Trạng thái,Thời gian điểm danh\n";
    attendanceList.forEach(a => {
      const status = a.checkedIn ? "Đã có mặt" : "Chưa điểm danh";
      csvContent += `"${a.id}","${a.name}","${a.hamlet}","${a.role}","${a.qrData || a.id}","${status}","${a.checkinTime || ''}"\n`;
    });
    downloadCsv(csvContent, `Bao_Cao_Diem_Danh_Dai_Bieu_Hoa_Khanh_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
  });
}

/* HELPER FUNCTIONS */
async function saveDatabase() {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appDatabase)
    }).then(r => r.json());
    return res;
  } catch (err) {
    console.error('Lỗi lưu DB:', err);
    showToast('Lỗi lưu dữ liệu máy chủ!', 'warning');
    return { success: false };
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Đã xuất file Excel/CSV thành công!', 'success');
}

/* =========================================================================
   QUẢN LÝ CẤU HÌNH GMAIL SMTP OTP
   ========================================================================= */
async function loadSmtpConfig() {
  try {
    const res = await fetch('/api/smtp/config').then(r => r.json());
    if (res.success) {
      const emailInput = document.getElementById('smtp-sender-email');
      const nameInput = document.getElementById('smtp-sender-name');
      const pwdStatus = document.getElementById('smtp-pwd-status');
      const statusBadge = document.getElementById('smtp-status-badge');

      if (emailInput && res.senderEmail) emailInput.value = res.senderEmail;
      if (nameInput && res.senderName) nameInput.value = res.senderName;
      if (pwdStatus) {
        if (res.hasAppPassword) {
          pwdStatus.innerHTML = '<span style="color: #34d399; font-weight: 700;">✅ Đã liên kết Google App Password</span>';
          if (statusBadge) {
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#34d399';
            statusBadge.innerHTML = '● Gửi thật qua Gmail SMTP (Chính thức)';
          }
        } else {
          pwdStatus.innerHTML = '<span style="color: #fde047;">Chưa có App Password (Đang ở chế độ mô phỏng)</span>';
          if (statusBadge) {
            statusBadge.style.background = 'rgba(234, 179, 8, 0.15)';
            statusBadge.style.color = '#fde047';
            statusBadge.innerHTML = '● Chế độ thử nghiệm OTP';
          }
        }
      }
    }
  } catch (err) {
    console.error('Lỗi tải cấu hình SMTP:', err);
  }
}

function initSmtpSettings() {
  loadSmtpConfig();

  const formSmtp = document.getElementById('form-smtp-settings');
  if (formSmtp) {
    formSmtp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const senderEmail = document.getElementById('smtp-sender-email').value.trim();
      const senderName = document.getElementById('smtp-sender-name').value.trim();
      const appPassword = document.getElementById('smtp-app-password').value.trim();
      const btnSave = document.getElementById('btn-save-smtp');

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = '⏳ Đang lưu cấu hình...';
      }

      try {
        const payload = { senderEmail, senderName };
        if (appPassword) payload.appPassword = appPassword;

        const res = await fetch('/api/smtp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.success) {
          showToast(res.message, 'success');
          document.getElementById('smtp-app-password').value = '';
          await loadSmtpConfig();
        } else {
          showToast(res.message || 'Lỗi lưu cấu hình!', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'warning');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = '💾 Lưu Cấu Hình Gmail OTP';
        }
      }
    });
  }

  // Nút kiểm tra gửi email thực tế
  const btnTest = document.getElementById('btn-run-smtp-test');
  const testResultEl = document.getElementById('smtp-test-result');

  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      const emailInput = document.getElementById('smtp-test-email');
      const testEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';

      if (!testEmail || !testEmail.includes('@')) {
        showToast('Vui lòng nhập địa chỉ Gmail nhận thử nghiệm hợp lệ!', 'warning');
        if (emailInput) emailInput.focus();
        return;
      }

      btnTest.disabled = true;
      btnTest.textContent = '⏳ Đang gửi email...';
      if (testResultEl) {
        testResultEl.style.display = 'block';
        testResultEl.style.color = '#38bdf8';
        testResultEl.innerHTML = '⚡ Đang gửi thử nghiệm đến <strong>' + testEmail + '</strong>...';
      }

      try {
        const res = await fetch('/api/smtp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testEmail })
        }).then(r => r.json());

        if (res.success) {
          showToast(res.message, 'success');
          if (testResultEl) {
            testResultEl.style.display = 'block';
            if (res.mode === 'smtp') {
              testResultEl.style.color = '#34d399';
              testResultEl.innerHTML = '🎉 <strong>Thành công!</strong> Đã gửi email OTP thực tế tới <strong>' + testEmail + '</strong>. Vui lòng kiểm tra Hộp thư đến hoặc Thư rác.';
            } else {
              testResultEl.style.color = '#fde047';
              testResultEl.innerHTML = '⚠️ <strong>Chế độ mô phỏng:</strong> ' + res.message + '<br>👉 Để gửi thật 100% đến Gmail, hãy dán Google App Password vào ô trên và bấm Lưu.';
            }
          }
        } else {
          showToast(res.message || 'Lỗi gửi thư!', 'warning');
          if (testResultEl) {
            testResultEl.style.display = 'block';
            testResultEl.style.color = '#f87171';
            testResultEl.textContent = '❌ Lỗi: ' + res.message;
          }
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ gửi thử!', 'warning');
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = '📨 Gửi Thử Ngay';
      }
    });
  }
}

/* =========================================================================
   QUẢN LÝ DANH SÁCH ĐOÀN VIÊN ĐÃ ĐĂNG KÝ
   ========================================================================= */
let registeredUsersList = [];

async function loadUsersList() {
  const tbody = document.getElementById('admin-users-table-body');
  const badgeCount = document.getElementById('badge-user-count');

  try {
    const res = await fetch('/api/auth/users').then(r => r.json());
    if (Array.isArray(res)) {
      registeredUsersList = res;
      if (badgeCount) badgeCount.textContent = registeredUsersList.length;

      if (!tbody) return;
      if (registeredUsersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--admin-muted); padding: 30px;">Chưa có tài khoản Đoàn viên nào đăng ký.</td></tr>';
        return;
      }

      tbody.innerHTML = registeredUsersList.map((u, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 700; color: var(--admin-cyan);">${idx + 1}</td>
          <td>
            <strong style="color: #fff;">${u.fullName}</strong>
          </td>
          <td><code>${u.username}</code></td>
          <td><span class="hamlet-pill">${u.hamlet || 'Đoàn Xã'}</span></td>
          <td>
            <a href="mailto:${u.email || ''}" style="color: #38bdf8; text-decoration: none;">
              ${u.email || '<span style="color: #64748b;">Chưa liên kết</span>'}
            </a>
          </td>
          <td style="text-align: center;">
            ${u.isEmailVerified
              ? '<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.3);">✅ Đã xác thực OTP</span>'
              : '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem;">Chưa xác thực</span>'}
          </td>
          <td>
            <span style="font-size: 0.78rem; font-weight: 700; color: ${u.role === 'admin' ? '#ffcc00' : '#94a3b8'};">
              ${u.role === 'admin' ? '👑 Quản Trị Viên' : '👤 Đoàn Viên'}
            </span>
          </td>
          <td style="font-size: 0.78rem; color: var(--admin-muted);">${u.createdAt || 'Mặc định'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Lỗi tải danh sách users:', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #f87171; padding: 20px;">Lỗi kết nối khi tải danh sách Đoàn viên!</td></tr>';
    }
  }
}

function initUsersManagement() {
  loadUsersList();
  const btnRefresh = document.getElementById('btn-refresh-users');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadUsersList();
      showToast('Đã làm mới danh sách tài khoản Đoàn viên!', 'success');
    });
  }
}
