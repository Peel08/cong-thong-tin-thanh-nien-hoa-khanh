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
    'tab-attendance': 'Quản lý điểm danh AI FaceID'
  };
  const titleEl = document.getElementById('admin-page-title');
  if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchAdminTab(tabId);
    });
  });

  document.getElementById('btn-sync-refresh').addEventListener('click', () => {
    loadAllData();
    showToast('Đang tải và đồng bộ lại dữ liệu...', 'success');
  });

  loadAllData();

  initOrgForm();
  initYouthEditForm();
  initVolunteerActions();
  initAttendanceActions();
});

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

/* 6. QUẢN LÝ ĐIỂM DANH AI FACEID */
function renderAttendanceTable() {
  const tbody = document.getElementById('table-attendance-tbody');
  tbody.innerHTML = '';

  attendanceList.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${a.id}</code></td>
      <td><strong>${a.name}</strong></td>
      <td><span class="status-pill status-green">${a.hamlet}</span></td>
      <td>${a.role}</td>
      <td>
        <span class="status-pill ${a.checkedIn ? 'status-green' : 'status-gold'}">
          ${a.checkedIn ? '✓ Đã có mặt' : 'Chưa điểm danh'}
        </span>
      </td>
      <td>${a.checkinTime || '--:--:--'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initAttendanceActions() {
  document.getElementById('btn-reset-att-admin').addEventListener('click', async () => {
    if (confirm('Đồng chí có chắc chắn muốn đặt lại toàn bộ trạng thái điểm danh?')) {
      await fetch('/api/checkin/reset', { method: 'POST' });
      attendanceList.forEach(a => { a.checkedIn = false; a.checkinTime = null; });
      renderAttendanceTable();
      renderOverview();
      showToast('Đã thiết lập lại điểm danh!', 'success');
    }
  });

  document.getElementById('btn-export-att-admin').addEventListener('click', () => {
    let csvContent = "\uFEFFMã ĐB,Họ và Tên,Đơn vị (Ấp),Chức vụ,Trạng thái,Thời gian điểm danh\n";
    attendanceList.forEach(a => {
      const status = a.checkedIn ? "Đã có mặt" : "Chưa điểm danh";
      csvContent += `"${a.id}","${a.name}","${a.hamlet}","${a.role}","${status}","${a.checkinTime || ''}"\n`;
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
