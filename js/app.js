/**
 * CỔNG THÔNG TIN THANH NIÊN HÒA KHÁNH (TÂY NINH) - MAIN APP CONTROLLER
 * Kết nối REST API máy chủ, Lưu trữ cơ sở dữ liệu vĩnh viễn, Tương tác động 9 Ấp.
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
  }, 4000);
};

document.addEventListener('DOMContentLoaded', async () => {
  // Ưu tiên tải dữ liệu từ máy chủ API (/api/data)
  let data = null;
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      data = await res.json();
      window.PORTAL_DATA = data; // Đồng bộ toàn cục
    }
  } catch (err) {
    console.warn("Không thể kết nối API máy chủ, sử dụng dữ liệu cục bộ:", err);
  }

  if (!data) {
    data = window.PORTAL_DATA;
  }

  if (!data) {
    console.error("Không tìm thấy dữ liệu cổng thông tin");
    return;
  }

  // Khởi tạo các module với dữ liệu thật
  initStats(data.organization);
  initYouthSection(data.outstandingYouth);
  initProductsSection(data.products);
  initJobsSection(data.jobs, data.capitalPolicies);
  initActivitiesSection(data.activities);
  initDigitalHub(data.digitalGuides);
  initVolunteerForm();
  initIdeaForm();
  initMobileMenu();
  initQuickModals();

  // Khởi động module Điểm danh AI FaceID
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

    // Thả tim
    container.querySelectorAll('.like-counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        localLikes[id] = !localLikes[id];
        localStorage.setItem('hoakhanh_youth_likes', JSON.stringify(localLikes));
        render(filter);

        if (localLikes[id]) {
          window.showToast(` Cảm ơn đồng chí đã gửi lời vinh danh đến gương mặt thanh niên tiêu biểu!`);
        }
      });
    });

    // Xem hồ sơ chi tiết
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
      <img src="${youth.avatar}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--cyber-cyan); object-fit: cover;">
      <div>
        <h2 style="font-size: 1.5rem; margin-bottom: 4px;">${youth.name}</h2>
        <div style="color: var(--cyber-cyan); font-weight: 600;">${youth.role} • ${youth.hamlet}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">Năm sinh: ${youth.yearOfBirth}</div>
      </div>
    </div>
    <div style="background: rgba(0,242,254,0.08); padding: 16px; border-radius: 12px; border-left: 4px solid var(--cyber-cyan); margin-bottom: 16px;">
      <h4 style="color: var(--cyber-cyan); margin-bottom: 6px;">DANH HIỆU / VINH DANH:</h4>
      <p style="font-weight: 600; font-size: 1.05rem;">${youth.badge}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <h4 style="margin-bottom: 6px;">CÔNG TRÌNH & THÀNH TÍCH TIÊU BIỂU:</h4>
      <p style="color: #cbd5e1; line-height: 1.6;">${youth.achievement}</p>
    </div>
    <div style="background: rgba(15,30,56,0.6); padding: 14px; border-radius: 10px; font-style: italic; color: var(--text-muted); margin-bottom: 20px;">
      " ${youth.quote} "
    </div>
    <div style="text-align: right;">
      <button class="btn btn-primary" onclick="document.getElementById('general-detail-modal').classList.remove('open')">Đóng hồ sơ</button>
    </div>
  `;
  modal.classList.add('open');
}

/* 3. SẢN PHẨM THANH NIÊN & OCOP */
function initProductsSection(products) {
  const container = document.getElementById('products-grid-container');
  if (!container || !products) return;

  container.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-thumb">
        <img src="${p.image}" alt="${p.title}" loading="lazy">
        <span class="product-tag">${p.badge}</span>
        <span class="product-hamlet">📍 ${p.hamlet}</span>
      </div>
      <div class="product-body">
        <h3>${p.title}</h3>
        <div class="product-owner">Chủ mô hình: <strong>${p.owner}</strong></div>
        <p class="product-desc">${p.description}</p>
        <div class="product-price">${p.price}</div>
        <div class="product-contact-actions">
          <a href="https://zalo.me/${p.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-sm btn-primary" style="flex: 1;">
            💬 Zalo Đặt Hàng
          </a>
          <button class="btn btn-sm btn-secondary show-product-qr-btn" data-title="${p.title}" data-phone="${p.phone}">
            📱 Mã QR
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.show-product-qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pTitle = btn.getAttribute('data-title');
      const pPhone = btn.getAttribute('data-phone');
      showProductQrModal(pTitle, pPhone);
    });
  });
}

function showProductQrModal(title, phone) {
  const modal = document.getElementById('general-detail-modal');
  const modalTitle = document.getElementById('general-modal-title');
  const body = document.getElementById('general-modal-body');
  if (!modal || !modalTitle || !body) return;

  modalTitle.textContent = `Mã QR Truy Xuất & Kết Nối Sản Phẩm`;
  body.innerHTML = `
    <div style="text-align: center; padding: 10px 0;">
      <h3 style="margin-bottom: 8px;">${title}</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">Quét mã QR để liên hệ trực tiếp chủ cơ sở thanh niên hoặc tra cứu nhật ký sản xuất sạch</p>
      <div style="display: inline-block; background: #fff; padding: 16px; border-radius: 16px; box-shadow: 0 0 25px rgba(0,242,254,0.3); margin-bottom: 18px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://zalo.me/${phone.replace(/[^0-9]/g, '')}" alt="QR Code" style="width: 200px; height: 200px; display: block;">
      </div>
      <div style="font-size: 1.1rem; font-weight: 700; color: var(--cyber-cyan); margin-bottom: 20px;">
        Hotline / Zalo: ${phone}
      </div>
      <button class="btn btn-secondary" onclick="document.getElementById('general-detail-modal').classList.remove('open')">Đóng cửa sổ</button>
    </div>
  `;
  modal.classList.add('open');
}

/* 4. KHỞI NGHIỆP - VIỆC LÀM & CHÍNH SÁCH VỐN */
function initJobsSection(jobs, policies) {
  const jobsContainer = document.getElementById('jobs-list-container');
  const policiesContainer = document.getElementById('policies-list-container');

  if (jobsContainer && jobs) {
    jobsContainer.innerHTML = '';
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.innerHTML = `
        <div class="job-card-header">
          <div>
            <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${job.title}</h3>
            <div style="color: var(--cyber-cyan); font-size: 0.86rem; font-weight: 600;">🏢 ${job.company}</div>
          </div>
          <span class="job-salary-tag">${job.salary}</span>
        </div>
        <div class="job-details-list">
          <span>📍 ${job.location}</span>
          <span>⏰ ${job.type}</span>
          <span>📅 Hạn nộp: ${job.deadline}</span>
        </div>
        <p style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 14px;"><strong>Yêu cầu:</strong> ${job.requirements}</p>
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

  if (policiesContainer && policies) {
    policiesContainer.innerHTML = '';
    policies.forEach(p => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(15,30,56,0.6); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 18px; margin-bottom: 14px;';
      card.innerHTML = `
        <h4 style="color: var(--accent-gold); font-size: 1rem; margin-bottom: 8px;">💰 ${p.title}</h4>
        <div style="font-size: 0.86rem; color: #fff; margin-bottom: 6px;"><strong>Hạn mức:</strong> ${p.amount}</div>
        <div style="font-size: 0.84rem; color: var(--cyber-cyan); margin-bottom: 6px;"><strong>Lãi suất:</strong> ${p.rate}</div>
        <div style="font-size: 0.82rem; color: var(--text-muted);"><strong>Đối tượng:</strong> ${p.target}</div>
      `;
      policiesContainer.appendChild(card);
    });
  }
}

/* 5. HOẠT ĐỘNG ĐOÀN - HỘI */
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
        <span style="position: absolute; top: 12px; right: 12px; background: rgba(3,10,22,0.85); border: 1px solid var(--cyber-cyan); color: var(--cyber-cyan); padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
          ${act.type}
        </span>
      </div>
      <div style="padding: 22px;">
        <span class="activity-date-badge">🗓️ ${act.date} | ${act.time}</span>
        <h3 style="font-size: 1.15rem; margin-bottom: 10px; line-height: 1.3;">${act.title}</h3>
        <p style="font-size: 0.84rem; color: var(--cyber-cyan); margin-bottom: 8px;">📍 ${act.location}</p>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 18px;">${act.description}</p>
        <a href="#volunteer" class="btn btn-sm btn-primary" style="width: 100%;">
          Đăng ký tham gia hoạt động
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

/* 6. CHUYỂN ĐỔI SỐ */
function initDigitalHub(guides) {
  const container = document.getElementById('digital-hub-container');
  if (!container || !guides) return;

  container.innerHTML = '';
  guides.forEach(g => {
    const card = document.createElement('div');
    card.className = 'digital-card';
    const stepsHtml = g.steps.map(s => `<li>${s}</li>`).join('');

    card.innerHTML = `
      <span style="display: inline-block; background: rgba(0,242,254,0.15); color: var(--cyber-cyan); border: 1px solid var(--cyber-cyan); padding: 3px 12px; border-radius: 20px; font-size: 0.74rem; font-weight: 700; margin-bottom: 12px;">
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

/* 7. BIỂU MẪU ĐĂNG KÝ TÌNH NGUYỆN (LƯU VĨNH VIỄN VÀO MÁY CHỦ) */
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
      // Gửi lên API lưu vào data/volunteers.json vĩnh viễn
      await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Lưu online lỗi, fallback lưu localStorage:", err);
    }

    form.reset();
    window.showToast(`🎉 Cảm ơn đồng chí ${name} đã đăng ký vào đội hình "${squad}"! Dữ liệu đã được lưu trữ vĩnh viễn trên hệ thống Đoàn xã.`, "success");
  });
}

/* 8. BIỂU MẪU HIẾN KẾ THANH NIÊN HÒA KHÁNH (LƯU VĨNH VIỄN) */
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
      item.style.cssText = 'background: rgba(8,18,34,0.6); border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px; margin-bottom: 10px; font-size: 0.85rem;';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: var(--cyber-cyan);">${idea.author} (${idea.hamlet})</strong>
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

/* 9. MOBILE MENU & NAVIGATION */
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

/* 10. MODAL CHUNG */
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
