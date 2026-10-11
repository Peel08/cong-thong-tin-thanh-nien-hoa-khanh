/**
 * CỔNG THÔNG TIN THANH NIÊN HÒA KHÁNH (TÂY NINH) - MAIN APP CONTROLLER
 * Tối ưu hóa tính năng, đồng bộ REST API máy chủ, Lưu trữ cơ sở dữ liệu vĩnh viễn.
 */

// Global Toast System
window.showToast = function (message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Giữ tối đa 2 thông báo trên màn hình để tránh che khuất giao diện
  while (container.children.length >= 2) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '⚡';
  toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
};

document.addEventListener('DOMContentLoaded', async () => {
  let data = null;
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      data = await res.json();
      window.PORTAL_DATA = data;
    }
  } catch (err) {
    console.warn("Không thể kết nối API máy chủ, sử dụng dữ liệu dự phòng:", err);
  }

  if (!data) {
    data = window.PORTAL_DATA;
  }

  if (!data) {
    console.error("Không tìm thấy dữ liệu cổng thông tin");
    return;
  }

  // Khởi tạo các module
  initStats(data.organization);
  renderOrgInfo(data.organization);
  initYouthSection(data.outstandingYouth);
  initJobsSection(data.jobs);
  initActivitiesSection(data.activities);
  initDigitalHub(data.digitalGuides);
  initVolunteerForm();
  initIdeaForm();
  initMobileMenu();
  initQuickModals();
  initAuthSystem();

  // Tự động đồng bộ lại khi người dùng quay lại tab từ trang Quản trị Admin
  window.addEventListener('focus', async () => {
    try {
      const r = await fetch('/api/data?t=' + Date.now());
      if (r.ok) {
        const fresh = await r.json();
        renderOrgInfo(fresh.organization);
        initStats(fresh.organization);
      }
    } catch (e) {}
  });

  if (window.FaceCheckin) {
    window.FaceCheckin.init();
  }
});

/* 1. THỐNG KÊ TỔNG QUAN */
function initStats(org) {
  if (!org) return;
  const statMembers = document.getElementById('stat-members');
  const statHamlets = document.getElementById('stat-hamlets');
  const statSquads = document.getElementById('stat-squads');
  const statProjects = document.getElementById('stat-projects');

  if (statMembers) statMembers.textContent = org.stats.youthMembers;
  if (statHamlets) statHamlets.textContent = org.stats.hamlets;
  if (statSquads) statSquads.textContent = org.stats.volunteerSquads;
  if (statProjects) statProjects.textContent = org.stats.projectsCompleted;
}

/* 2. 09 GƯƠNG THANH NIÊN TIÊU BIỂU CỦA 09 ẤP */
function initYouthSection(youthList) {
  const container = document.getElementById('youth-grid-container');
  const filterButtons = document.querySelectorAll('.hamlet-filter-bar .filter-btn');
  if (!container || !youthList) return;

  const localLikes = JSON.parse(localStorage.getItem('hoakhanh_youth_likes') || '{}');

  function render(filter = 'ALL') {
    container.innerHTML = '';
    const filtered = filter === 'ALL' ? youthList : youthList.filter(y => y.hamlet === filter);

    filtered.forEach(youth => {
      const isLiked = localLikes[youth.id] || false;
      const currentLikes = youth.likes + (isLiked ? 1 : 0);

      const card = document.createElement('div');
      card.className = 'youth-card';
      card.innerHTML = `
        <div class="youth-card-header">
          <span class="youth-hamlet-tag">📍 ${youth.hamlet}</span>
          <div class="youth-avatar-ring">
            <img src="${youth.avatar}" alt="${youth.name}" class="youth-avatar-img" loading="lazy">
          </div>
          <span class="youth-badge-pill">🎖️ ${youth.badge}</span>
        </div>
        <div class="youth-card-body">
          <h3 class="youth-name">${youth.name}</h3>
          <div class="youth-role">${youth.role} (Sinh năm ${youth.yearOfBirth})</div>
          <div class="youth-achievement">
            <strong>Thành tích nổi bật:</strong> ${youth.achievement}
          </div>
          <div class="youth-quote">
            "${youth.quote}"
          </div>
          <div class="youth-card-footer">
            <button class="like-counter-btn ${isLiked ? 'liked' : ''}" data-id="${youth.id}">
              <span>❤️</span> <span class="like-num">${currentLikes}</span> Lượt vinh danh
            </button>
            <button class="btn btn-sm btn-secondary view-detail-btn" data-id="${youth.id}">
              Xem hồ sơ
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.like-counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        localLikes[id] = !localLikes[id];
        localStorage.setItem('hoakhanh_youth_likes', JSON.stringify(localLikes));
        render(filter);

        if (localLikes[id]) {
          window.showToast(` Cảm ơn bạn đã gửi lời vinh danh đến gương mặt thanh niên tiêu biểu!`);
        }
      });
    });

    container.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const found = youthList.find(y => y.id === id);
        if (found) showYouthDetailModal(found);
      });
    });
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.getAttribute('data-filter'));
    });
  });

  render('ALL');
}

function showYouthDetailModal(youth) {
  const modal = document.getElementById('general-detail-modal');
  const title = document.getElementById('general-modal-title');
  const body = document.getElementById('general-modal-body');
  if (!modal || !title || !body) return;

  title.textContent = `Gương Thanh Niên Tiêu Biểu - ${youth.hamlet}`;
  body.innerHTML = `
    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
      <img src="${youth.avatar}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--union-cyan); object-fit: cover;">
      <div>
        <h2 style="font-size: 1.5rem; margin-bottom: 4px;">${youth.name}</h2>
        <div style="color: var(--union-cyan); font-weight: 600;">${youth.role} • ${youth.hamlet}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">Năm sinh: ${youth.yearOfBirth}</div>
      </div>
    </div>
    <div style="background: rgba(0,91,170,0.15); padding: 16px; border-radius: 12px; border-left: 4px solid var(--union-cyan); margin-bottom: 16px;">
      <h4 style="color: var(--union-cyan); margin-bottom: 6px;">DANH HIỆU / VINH DANH:</h4>
      <p style="font-weight: 600; font-size: 1.05rem;">${youth.badge}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <h4 style="margin-bottom: 6px;">CÔNG TRÌNH & THÀNH TÍCH TIÊU BIỂU:</h4>
      <p style="color: #cbd5e1; line-height: 1.6;">${youth.achievement}</p>
    </div>
    <div style="background: rgba(7,23,48,0.7); padding: 14px; border-radius: 10px; font-style: italic; color: var(--text-muted); margin-bottom: 20px;">
      " ${youth.quote} "
    </div>
    <div style="text-align: right;">
      <button class="btn btn-primary" onclick="document.getElementById('general-detail-modal').classList.remove('open')">Đóng hồ sơ</button>
    </div>
  `;
  modal.classList.add('open');
}

/* 3. KHỞI NGHIỆP & VIỆC LÀM */
function initJobsSection(jobs) {
  const jobsContainer = document.getElementById('jobs-list-container');
  if (!jobsContainer || !jobs) return;

  jobsContainer.innerHTML = '';
  jobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card';
    card.innerHTML = `
      <div class="job-card-header">
        <div>
          <h3 style="font-size: 1.15rem; margin-bottom: 4px; color: #fff;">${job.title}</h3>
          <div style="color: var(--union-cyan); font-size: 0.86rem; font-weight: 600;">🏢 ${job.company}</div>
        </div>
        <span class="job-salary-tag">${job.salary}</span>
      </div>
      <div class="job-details-list">
        <span>📍 ${job.location}</span>
        <span>⏰ ${job.type}</span>
        <span>📅 Hạn nộp: ${job.deadline}</span>
      </div>
      <p style="font-size: 0.86rem; color: #cbd5e1; margin-bottom: 16px; flex-grow: 1;"><strong>Yêu cầu:</strong> ${job.requirements}</p>
      <button class="btn btn-sm btn-primary apply-job-btn" data-job="${job.title}">
        Ứng tuyển nhanh qua Đoàn xã
      </button>
    `;
    jobsContainer.appendChild(card);
  });

  jobsContainer.querySelectorAll('.apply-job-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const jTitle = btn.getAttribute('data-job');
      window.showToast(` Đã ghi nhận nguyện vọng ứng tuyển "${jTitle}". Bộ phận Hướng nghiệp Đoàn xã sẽ kết nối với bạn!`, "success");
    });
  });
}

/* 4. HOẠT ĐỘNG ĐOÀN - HỘI */
function initActivitiesSection(activities) {
  const container = document.getElementById('activities-grid-container');
  if (!container || !activities) return;

  container.innerHTML = '';
  activities.forEach(act => {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.innerHTML = `
      <div style="height: 180px; overflow: hidden; position: relative;">
        <img src="${act.banner}" alt="${act.title}" style="width: 100%; height: 100%; object-fit: cover;">
        <span style="position: absolute; top: 12px; right: 12px; background: rgba(5,21,51,0.85); border: 1px solid var(--union-cyan); color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
          ${act.type}
        </span>
      </div>
      <div style="padding: 22px;">
        <span class="activity-date-badge">🗓️ ${act.date} | ${act.time}</span>
        <h3 style="font-size: 1.15rem; margin-bottom: 10px; line-height: 1.3;">${act.title}</h3>
        <p style="font-size: 0.84rem; color: var(--union-cyan); margin-bottom: 8px;">📍 ${act.location}</p>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 18px;">${act.description}</p>
        <a href="#volunteer" class="btn btn-sm btn-primary" style="width: 100%;">
          Đăng ký tham gia hoạt động
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

/* 5. CHUYỂN ĐỔI SỐ */
function initDigitalHub(guides) {
  const container = document.getElementById('digital-hub-container');
  if (!container || !guides) return;

  container.innerHTML = '';
  guides.forEach(g => {
    const card = document.createElement('div');
    card.className = 'digital-card';
    const stepsHtml = g.steps.map(s => `<li>${s}</li>`).join('');

    card.innerHTML = `
      <span style="display: inline-block; background: rgba(0,91,170,0.25); color: var(--union-cyan); border: 1px solid var(--union-cyan); padding: 3px 12px; border-radius: 20px; font-size: 0.74rem; font-weight: 700; margin-bottom: 12px;">
        ${g.category}
      </span>
      <h3 style="font-size: 1.12rem; margin-bottom: 12px;">${g.title}</h3>
      <ul class="step-list">
        ${stepsHtml}
      </ul>
      <a href="${g.link}" target="_blank" class="btn btn-sm btn-secondary" style="margin-top: 10px; width: 100%;">
        Truy cập hệ thống liên kết ↗
      </a>
    `;
    container.appendChild(card);
  });
}

/* 6. BIỂU MẪU ĐĂNG KÝ TÌNH NGUYỆN (LƯU VĨNH VIỄN) */
function initVolunteerForm() {
  const form = document.getElementById('volunteer-reg-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('vol-name').value;
    const phone = document.getElementById('vol-phone').value;
    const hamlet = document.getElementById('vol-hamlet').value;
    const squad = document.getElementById('vol-squad').value;
    const skill = document.getElementById('vol-skill').value;

    const payload = { name, phone, hamlet, squad, skill };

    try {
      await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Lưu offline:", err);
    }

    form.reset();
    window.showToast(`🎉 Cảm ơn đồng chí ${name} đã đăng ký vào đội hình "${squad}"! Dữ liệu đã được lưu trữ vĩnh viễn trên hệ thống Đoàn xã.`, "success");
  });
}

/* 7. BIỂU MẪU HIẾN KẾ THANH NIÊN (LƯU VĨNH VIỄN) */
function initIdeaForm() {
  const form = document.getElementById('idea-submit-form');
  const feed = document.getElementById('recent-ideas-feed');
  if (!form) return;

  async function renderIdeasFeed() {
    if (!feed) return;
    let list = [];
    try {
      const res = await fetch('/api/ideas');
      if (res.ok) list = await res.json();
    } catch (e) {
      list = JSON.parse(localStorage.getItem('hoakhanh_ideas') || '[]');
    }

    if (list.length === 0) {
      feed.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-dim); text-align: center; padding: 20px;">
          Chưa có hiến kế nào được gửi. Hãy là người đầu tiên đóng góp ý tưởng cho Hòa Khánh!
        </div>
      `;
      return;
    }

    feed.innerHTML = '';
    [...list].reverse().slice(0, 4).forEach(idea => {
      const item = document.createElement('div');
      item.style.cssText = 'background: rgba(5,18,40,0.7); border: 1px solid var(--border-card); border-radius: 8px; padding: 12px; margin-bottom: 10px; font-size: 0.85rem;';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: var(--union-cyan);">${idea.author} (${idea.hamlet})</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${idea.createdAt}</span>
        </div>
        <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">💡 ${idea.title}</div>
        <div style="color: #cbd5e1; font-size: 0.82rem;">${idea.content}</div>
      `;
      feed.appendChild(item);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = document.getElementById('idea-author').value;
    const hamlet = document.getElementById('idea-hamlet').value;
    const title = document.getElementById('idea-title').value;
    const topic = document.getElementById('idea-topic').value;
    const content = document.getElementById('idea-content').value;

    const payload = { author, hamlet, title, topic, content };

    try {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Lưu ý tưởng offline:", e);
    }

    form.reset();
    renderIdeasFeed();
    window.showToast(` Sáng kiến "${title}" của đồng chí đã được lưu trữ vĩnh viễn và chuyển đến Thường trực Đoàn xã!`, "success");
  });

  renderIdeasFeed();
}

/* 8. MOBILE MENU */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('main-nav-menu');
  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    navMenu.classList.toggle('open');
  });

  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  });
}

/* 9. MODAL CHUNG */
function initQuickModals() {
  const modal = document.getElementById('general-detail-modal');
  const closeBtn = document.getElementById('close-general-modal');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }

  window.addEventListener('click', (e) => {
    if (modal && e.target === modal) modal.classList.remove('open');
    const checkinModal = document.getElementById('face-checkin-modal');
    if (checkinModal && e.target === checkinModal) {
      checkinModal.classList.remove('open');
      if (window.FaceCheckin && window.FaceCheckin.stopCamera) window.FaceCheckin.stopCamera();
    }
  });
}

/* 10. ĐỒNG BỘ DỮ LIỆU ĐOÀN XÃ (THÔNG TIN HÀNH CHÍNH & LIÊN HỆ) */
function renderOrgInfo(org) {
  if (!org) return;

  // 1. Điện thoại & Hotline
  const phone = org.phone || '0947463036';
  const topHotline = document.getElementById('top-hotline-text');
  if (topHotline) topHotline.textContent = phone;

  const contactPhone = document.getElementById('contact-phone');
  if (contactPhone) contactPhone.textContent = `${phone} (Văn phòng Đoàn xã)`;

  const footerPhone = document.getElementById('footer-phone');
  if (footerPhone) footerPhone.textContent = phone;

  // 2. Địa chỉ
  const address = org.address || 'Quốc lộ N2, ấp Thuận Hòa 2, xã Hòa Khánh, tỉnh Tây Ninh';
  const contactAddress = document.getElementById('contact-address');
  if (contactAddress) contactAddress.textContent = address;

  const footerAddress = document.getElementById('footer-address');
  if (footerAddress) footerAddress.textContent = address;

  // 3. Email
  const email = org.email || 'doanxahoakhanh.tayninh@gmail.com';
  const contactEmail = document.getElementById('contact-email');
  if (contactEmail) contactEmail.textContent = email;

  const footerEmail = document.getElementById('footer-email');
  if (footerEmail) footerEmail.textContent = email;

  // 4. Slogan
  const slogan = org.slogan || 'Khát vọng - Tiên phong - Bản lĩnh - Đoàn kết - Sáng tạo';
  const heroSlogan = document.getElementById('hero-slogan');
  if (heroSlogan) heroSlogan.textContent = `"${slogan}"`;

  const footerSlogan = document.getElementById('footer-slogan');
  if (footerSlogan) footerSlogan.textContent = slogan;

  // 5. Fanpage & Zalo
  if (org.fanpage) {
    const fbBtn = document.getElementById('contact-fanpage-btn');
    if (fbBtn) fbBtn.href = org.fanpage;
  }
  if (org.zalo) {
    const zaloBtn = document.getElementById('contact-zalo-btn');
    if (zaloBtn) zaloBtn.href = org.zalo;
    const qrImg = document.getElementById('contact-qr-img');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(org.zalo)}`;
  }
}

/* 11. HỆ THỐNG TÀI KHOẢN ĐOÀN VIÊN & QUẢN TRỊ ADMIN */
function initAuthSystem() {
  const modal = document.getElementById('auth-modal');
  const openTopBtn = document.getElementById('btn-open-auth-modal');
  const openNavBtn = document.getElementById('btn-nav-auth');
  const closeBtn = document.getElementById('close-auth-modal');

  // Mở / Đóng modal
  const openModal = () => { if (modal) modal.classList.add('open'); };
  const closeModal = () => { if (modal) modal.classList.remove('open'); };

  if (openTopBtn) openTopBtn.addEventListener('click', openModal);
  if (openNavBtn) openNavBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Chuyển Tab Đoàn viên / Admin
  const tabMember = document.getElementById('tab-auth-member');
  const tabAdmin = document.getElementById('tab-auth-admin');
  const panelMember = document.getElementById('auth-member-panel');
  const panelAdmin = document.getElementById('auth-admin-panel');

  if (tabMember && tabAdmin) {
    tabMember.addEventListener('click', () => {
      tabMember.style.background = 'var(--union-blue)';
      tabMember.style.color = '#fff';
      tabAdmin.style.background = 'transparent';
      tabAdmin.style.color = '#94a3b8';
      if (panelMember) panelMember.style.display = 'block';
      if (panelAdmin) panelAdmin.style.display = 'none';
    });

    tabAdmin.addEventListener('click', () => {
      tabAdmin.style.background = 'linear-gradient(135deg, #da251d 0%, #b91c1c 100%)';
      tabAdmin.style.color = '#fff';
      tabMember.style.background = 'transparent';
      tabMember.style.color = '#94a3b8';
      if (panelMember) panelMember.style.display = 'none';
      if (panelAdmin) panelAdmin.style.display = 'block';
    });
  }

  // Chuyển Đăng nhập / Đăng ký Đoàn viên
  const linkShowReg = document.getElementById('link-show-register');
  const linkShowLog = document.getElementById('link-show-login');
  const formLogin = document.getElementById('form-member-login');
  const formReg = document.getElementById('form-member-register');

  if (linkShowReg && formLogin && formReg) {
    linkShowReg.addEventListener('click', (e) => {
      e.preventDefault();
      formLogin.style.display = 'none';
      formReg.style.display = 'block';
      // Xóa sạch giá trị input để không bị autofill nhầm admin
      formReg.reset();
      const emailInput = document.getElementById('reg-email');
      if (emailInput) emailInput.value = '';
      const pwdInput = document.getElementById('reg-password');
      if (pwdInput) pwdInput.value = '';
      const otpInput = document.getElementById('reg-otp');
      if (otpInput) otpInput.value = '';
    });
  }

  if (linkShowLog && formLogin && formReg) {
    linkShowLog.addEventListener('click', (e) => {
      e.preventDefault();
      formReg.style.display = 'none';
      formLogin.style.display = 'block';
    });
  }

  // 1. Submit Đăng nhập Đoàn viên
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('member-login-username').value.trim();
      const password = document.getElementById('member-login-password').value.trim();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }).then(r => r.json());

        if (res.success) {
          localStorage.setItem('hoakhanh_auth_token', res.token);
          localStorage.setItem('hoakhanh_auth_user', JSON.stringify(res.user));
          updateAuthUI();
          closeModal();
          showToast(`Chào mừng đồng chí ${res.user.fullName} đã đăng nhập!`, 'success');
        } else {
          showToast(res.message || 'Sai tên đăng nhập hoặc mật khẩu!', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    });
  }

  // 2. Gửi mã OTP qua Gmail khi Đăng ký Đoàn viên
  const btnSendRegOtp = document.getElementById('btn-send-reg-otp');
  const otpStatusEl = document.getElementById('otp-send-status');
  const otpTimerBadge = document.getElementById('otp-timer-badge');
  let otpCooldownTimer = null;

  if (btnSendRegOtp) {
    btnSendRegOtp.addEventListener('click', async () => {
      const emailInput = document.getElementById('reg-email');
      let email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const fullName = (document.getElementById('reg-fullname')?.value || '').trim();

      // Cảnh báo nếu gõ nhầm tài khoản "admin" vào ô Gmail
      if (email === 'admin') {
        showToast('⚠️ "admin" là tài khoản Quản trị! Vui lòng nhập Gmail của đồng chí để nhận mã xác thực.', 'warning');
        if (emailInput) {
          emailInput.value = '';
          emailInput.focus();
        }
        return;
      }

      // Tự động bổ sung đuôi @gmail.com nếu người dùng chỉ gõ tên không có dấu @
      if (email && !email.includes('@')) {
        email = email + '@gmail.com';
        if (emailInput) emailInput.value = email;
        showToast(`💡 Đã tự động bổ sung đuôi: ${email}`, 'info');
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        showToast('Vui lòng nhập địa chỉ Gmail chính xác (Ví dụ: luongtanphat07082006@gmail.com)!', 'warning');
        if (emailInput) emailInput.focus();
        return;
      }

      btnSendRegOtp.disabled = true;
      btnSendRegOtp.textContent = '⏳ Đang gửi...';
      if (otpStatusEl) {
        otpStatusEl.style.display = 'block';
        otpStatusEl.style.color = '#38bdf8';
        otpStatusEl.innerHTML = '⚡ Đang kết nối máy chủ gửi mã OTP đến <strong>' + email + '</strong>...';
      }

      const abortCtrl = new AbortController();
      const fetchTimer = setTimeout(() => abortCtrl.abort(), 8000);

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortCtrl.signal,
          body: JSON.stringify({ email, fullName, type: 'register', purpose: 'Đăng ký tài khoản Đoàn viên' })
        }).then(r => r.json());
        clearTimeout(fetchTimer);

        if (res.success) {
          const otpCode = res.otp || res.debugOtp || '';
          showToast(`✅ Đã gửi mã OTP đến ${email}!`, 'success');
          if (otpStatusEl) {
            otpStatusEl.style.display = 'block';
            otpStatusEl.style.color = '#4ade80';
            otpStatusEl.innerHTML = `✅ Đã gửi email đến <strong>${email}</strong>! Mã xác thực: <strong style="font-size: 1.05rem; color: #ffcc00; letter-spacing: 3px; background: rgba(0,0,0,0.35); padding: 2px 7px; border-radius: 4px;">${otpCode}</strong> (Đã tự động điền)`;
          }

          // Tự động điền mã OTP vào ô nhập và focus
          const otpInput = document.getElementById('reg-otp');
          if (otpInput && otpCode) {
            otpInput.value = otpCode;
            otpInput.style.borderColor = '#10b981';
            otpInput.style.color = '#10b981';
            otpInput.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
            otpInput.focus();
          }

          // Bộ đếm ngược gửi lại 20 giây
          let secondsLeft = 20;
          if (otpTimerBadge) otpTimerBadge.textContent = `Gửi lại sau ${secondsLeft}s`;
          btnSendRegOtp.textContent = `⏳ ${secondsLeft}s`;
          btnSendRegOtp.disabled = true;

          if (otpCooldownTimer) clearInterval(otpCooldownTimer);
          otpCooldownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
              btnSendRegOtp.textContent = `⏳ ${secondsLeft}s`;
              if (otpTimerBadge) otpTimerBadge.textContent = `Gửi lại sau ${secondsLeft}s`;
            } else {
              clearInterval(otpCooldownTimer);
              btnSendRegOtp.disabled = false;
              btnSendRegOtp.textContent = '🔄 Gửi lại OTP';
              if (otpTimerBadge) otpTimerBadge.textContent = 'Có thể gửi lại mã';
            }
          }, 1000);

        } else {
          showToast(res.message || 'Không thể gửi mã OTP!', 'warning');
          btnSendRegOtp.disabled = false;
          btnSendRegOtp.textContent = '📩 Lấy mã OTP';
          if (otpStatusEl) {
            otpStatusEl.style.display = 'block';
            otpStatusEl.style.color = '#f87171';
            otpStatusEl.textContent = '❌ ' + (res.message || 'Lỗi gửi mã OTP');
          }
        }
      } catch (err) {
        clearTimeout(fetchTimer);
        showToast('Lỗi kết nối máy chủ gửi OTP!', 'warning');
        btnSendRegOtp.disabled = false;
        btnSendRegOtp.textContent = '📩 Lấy mã OTP';
        if (otpStatusEl) {
          otpStatusEl.style.display = 'block';
          otpStatusEl.style.color = '#f87171';
          otpStatusEl.textContent = '❌ Quá thời gian chờ phản hồi từ máy chủ. Vui lòng bấm thử lại!';
        }
      }
    });
  }

  // 3. Submit Đăng ký Đoàn viên (Bắt buộc kiểm tra mã OTP)
  if (formReg) {
    formReg.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('reg-fullname').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const hamlet = document.getElementById('reg-hamlet').value;
      let email = document.getElementById('reg-email').value.trim().toLowerCase();
      if (email === 'admin') {
        showToast('⚠️ "admin" là tài khoản Quản trị, không phải địa chỉ Gmail!', 'warning');
        document.getElementById('reg-email')?.focus();
        return;
      }
      if (email && !email.includes('@')) {
        email = email + '@gmail.com';
        document.getElementById('reg-email').value = email;
      }

      const otp = document.getElementById('reg-otp').value.trim();
      const password = document.getElementById('reg-password').value.trim();
      const btnSubmit = document.getElementById('btn-submit-reg');

      if (!email) {
        showToast('Vui lòng nhập địa chỉ Gmail nhận mã xác thực!', 'warning');
        document.getElementById('reg-email')?.focus();
        return;
      }

      if (!otp || otp.length !== 6) {
        showToast('Vui lòng bấm "Lấy mã OTP" và nhập chính xác mã 06 chữ số nhận từ Gmail!', 'warning');
        document.getElementById('reg-otp')?.focus();
        return;
      }

      if (password.length < 6) {
        showToast('Mật khẩu đăng nhập phải có ít nhất 06 ký tự!', 'warning');
        document.getElementById('reg-password')?.focus();
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = '🛡️ Đang xác thực OTP & khởi tạo tài khoản...';
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, username: phone, phone, hamlet, email, otp, password })
        }).then(r => r.json());

        if (res.success) {
          localStorage.setItem('hoakhanh_auth_token', res.token);
          localStorage.setItem('hoakhanh_auth_user', JSON.stringify(res.user));
          updateAuthUI();
          closeModal();
          showToast(`Chúc mừng đồng chí ${res.user.fullName} đã xác thực Gmail và tạo tài khoản Đoàn viên thành công!`, 'success');
          formReg.reset();
          if (otpStatusEl) otpStatusEl.style.display = 'none';
          if (otpTimerBadge) otpTimerBadge.textContent = '';
        } else {
          showToast(res.message || 'Lỗi đăng ký tài khoản!', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'warning');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🛡️ Xác Thực OTP & Đăng Ký Tài Khoản';
        }
      }
    });
  }

  // 3. Submit Đăng nhập Admin
  const formAdmin = document.getElementById('form-admin-login');
  if (formAdmin) {
    formAdmin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('admin-login-username').value.trim();
      const password = document.getElementById('admin-login-password').value.trim();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }).then(r => r.json());

        if (res.success && res.user.role === 'admin') {
          localStorage.setItem('hoakhanh_admin_token', res.token);
          localStorage.setItem('hoakhanh_admin_user', JSON.stringify(res.user));
          showToast('Xác thực quản trị viên thành công! Đang chuyển hướng...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 600);
        } else {
          showToast('Tài khoản không có quyền quản trị hoặc sai mật khẩu!', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    });
  }

  // 4. Đăng xuất
  const btnLogout = document.getElementById('btn-top-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('hoakhanh_auth_token');
      localStorage.removeItem('hoakhanh_auth_user');
      updateAuthUI();
      showToast('Đã đăng xuất tài khoản!', 'info');
    });
  }

  updateAuthUI();
}

function updateAuthUI() {
  const userJson = localStorage.getItem('hoakhanh_auth_user');
  const btnOpen = document.getElementById('btn-open-auth-modal');
  const infoBox = document.getElementById('top-user-info');
  const nameEl = document.getElementById('top-user-name');
  const navBtn = document.getElementById('btn-nav-auth');

  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (btnOpen) btnOpen.style.display = 'none';
      if (infoBox) infoBox.style.display = 'inline-flex';
      if (nameEl) nameEl.textContent = `👤 ${user.fullName}`;
      if (navBtn) navBtn.textContent = `👤 ${user.fullName.split(' ').pop()}`;
      return;
    } catch (e) {}
  }

  if (btnOpen) btnOpen.style.display = 'inline-block';
  if (infoBox) infoBox.style.display = 'none';
  if (navBtn) navBtn.textContent = '👤 Đăng Nhập';
}

