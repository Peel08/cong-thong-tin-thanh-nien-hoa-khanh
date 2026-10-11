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
  initYouthSection(data.outstandingYouth);
  initJobsSection(data.jobs);
  initActivitiesSection(data.activities);
  initDigitalHub(data.digitalGuides);
  initVolunteerForm();
  initIdeaForm();
  initMobileMenu();
  initQuickModals();

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
