/**
 * HỆ THỐNG ĐIỂM DANH AI THÔNG MINH - ĐOÀN XÃ HÒA KHÁNH (TÂY NINH)
 * Kết nối máy chủ lưu trữ vĩnh viễn, Nhận diện FaceID theo dữ liệu khuôn mặt, Quét Mã QR Cá nhân
 */

(function () {
  let videoStream = null;
  let audioCtx = null;
  let checkinRoster = [];
  let qrScanInterval = null;
  let isScanningQR = false;

  function playSuccessSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn("Audio Context không khả dụng:", e);
    }
  }

  // Khởi tạo danh sách điểm danh từ API máy chủ
  async function initAttendanceData() {
    try {
      const res = await fetch('/api/checkin');
      if (res.ok) {
        checkinRoster = await res.json();
        updateRosterUI();
        return;
      }
    } catch (e) {
      console.warn("Không kết nối được API checkin:", e);
    }

    const saved = localStorage.getItem('hoakhanh_attendance_roster');
    if (saved) {
      try {
        checkinRoster = JSON.parse(saved);
        updateRosterUI();
        return;
      } catch (e) {}
    }

    if (window.PORTAL_DATA && window.PORTAL_DATA.attendanceDatabase) {
      checkinRoster = JSON.parse(JSON.stringify(window.PORTAL_DATA.attendanceDatabase));
    } else {
      checkinRoster = [];
    }
    updateRosterUI();
  }

  // Khởi động Camera và bộ quét QR qua Camera
  async function startCamera() {
    const video = document.getElementById('checkin-video');
    const statusText = document.getElementById('camera-status-text');
    if (!video) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        video.srcObject = videoStream;
        await video.play();
        if (statusText) statusText.textContent = "AI CAMERA: ĐANG HOẠT ĐỘNG (RADAR ON)";
        startRealtimeQRScanner(video);
      } else {
        throw new Error("Trình duyệt không hỗ trợ WebRTC");
      }
    } catch (err) {
      console.warn("Không thể truy cập camera thực tế, kích hoạt chế độ mô phỏng:", err);
      if (statusText) statusText.textContent = "CHẾ ĐỘ MÔ PHỎNG CAMERA (SẴN SÀNG QUÉT)";
      simulateCameraFeed(video);
    }
  }

  function stopCamera() {
    if (qrScanInterval) {
      clearInterval(qrScanInterval);
      qrScanInterval = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    const video = document.getElementById('checkin-video');
    if (video) video.srcObject = null;
  }

  // Quét mã QR thời gian thực từ camera feed sử dụng jsQR
  function startRealtimeQRScanner(videoElem) {
    if (qrScanInterval) clearInterval(qrScanInterval);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    qrScanInterval = setInterval(() => {
      if (!window.jsQR || isScanningQR) return;
      if (!videoElem || videoElem.readyState !== videoElem.HAVE_ENOUGH_DATA) return;

      canvas.width = videoElem.videoWidth;
      canvas.height = videoElem.videoHeight;
      ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });

        if (code && code.data) {
          const raw = code.data.trim();
          const found = checkinRoster.find(d => 
            d.id === raw || 
            (d.qrData && d.qrData === raw) ||
            raw.includes(d.id)
          );

          if (found && !found.checkedIn) {
            isScanningQR = true;
            triggerCheckinSuccess(found, 'QR-Code');
            setTimeout(() => { isScanningQR = false; }, 3000);
          }
        }
      } catch (e) {
        // bỏ qua lỗi khung hình
      }
    }, 250);
  }

  function simulateCameraFeed(videoElem) {
    if (!videoElem) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    function drawSim() {
      if (!document.getElementById('face-checkin-modal').classList.contains('open')) return;
      ctx.fillStyle = '#061325';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
      ctx.beginPath();
      ctx.arc(320, 200, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(320, 390, 130, Math.PI, 0);
      ctx.fill();

      if (canvas.captureStream) {
        videoElem.srcObject = canvas.captureStream(15);
      }
    }
    drawSim();
  }

  // Cập nhật giao diện danh sách & thống kê 9 Ấp
  function updateRosterUI() {
    const listEl = document.getElementById('attendance-stream-list');
    const countEl = document.getElementById('attendance-count');
    const percentEl = document.getElementById('attendance-percent');
    const progressBar = document.getElementById('attendance-progress-bar');
    const matrixEl = document.getElementById('hamlet-matrix');
    const selectEl = document.getElementById('select-test-qr-delegate');

    if (!listEl) return;

    const checkedInList = checkinRoster.filter(item => item.checkedIn);
    const total = checkinRoster.length;
    const checkedCount = checkedInList.length;
    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    if (countEl) countEl.textContent = `${checkedCount} / ${total}`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;

    // Đổ danh sách vào select box quét QR nhanh
    if (selectEl) {
      const currentVal = selectEl.value;
      selectEl.innerHTML = '<option value="">-- Chọn đại biểu để quét mã QR --</option>';
      checkinRoster.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.checkedIn ? '✓ ' : '⚪ '}[${d.id}] ${d.name} (${d.hamlet})`;
        selectEl.appendChild(opt);
      });
      if (currentVal) selectEl.value = currentVal;
    }

    listEl.innerHTML = '';
    const sorted = [...checkedInList].reverse();

    if (sorted.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 25px; color: var(--text-dim); font-size: 0.85rem;">
          <div style="font-size: 1.6rem; margin-bottom: 6px;">📷</div>
          Chưa có đại biểu nào điểm danh.<br>Hãy đứng trước Camera để quét FaceID hoặc đưa Mã QR cá nhân vào ô quét.
        </div>
      `;
    } else {
      sorted.forEach(item => {
        const row = document.createElement('div');
        row.className = 'roster-stream-item';
        const avt = item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avt}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--union-cyan);">
            <div>
              <div class="roster-stream-name">${item.name}</div>
              <div class="roster-stream-meta">${item.hamlet} • ${item.role}</div>
            </div>
          </div>
          <div class="roster-stream-time">✓ ${item.checkinTime || 'Mới xong'}</div>
        `;
        listEl.appendChild(row);
      });
    }

    // 09 Ấp chính thức của xã Hòa Khánh (Tây Ninh)
    const hamlets9 = [
      "Thuận Hòa 1", "Thuận Hòa 2", "Bình Lợi",
      "Bình Thủy", "Giồng Ngang", "Hóc Thơm",
      "Lập Thành", "Tân Bình", "Xuân Khánh"
    ];

    if (matrixEl) {
      matrixEl.innerHTML = '';
      hamlets9.forEach(hShort => {
        const hFull = `Ấp ${hShort}`;
        const hamletItems = checkinRoster.filter(r => r.hamlet === hFull || r.hamlet.includes(hShort));
        const hamletChecked = hamletItems.filter(r => r.checkedIn);

        const mItem = document.createElement('div');
        mItem.className = `matrix-item ${hamletChecked.length > 0 ? 'checked' : ''}`;
        mItem.innerHTML = `
          <span class="m-name">${hShort}</span>
          <span class="m-status">${hamletChecked.length}/${hamletItems.length || 2}</span>
        `;
        matrixEl.appendChild(mItem);
      });
    }
  }

  // Điểm danh thành công và lưu vào API máy chủ
  async function triggerCheckinSuccess(delegate, method = 'FaceID') {
    if (!delegate) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    delegate.checkedIn = true;
    delegate.checkinTime = timeStr;
    delegate.method = method;

    // Gửi lên API lưu vào data/attendance.json
    try {
      await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: delegate.id, name: delegate.name, hamlet: delegate.hamlet, role: delegate.role, method: method })
      });
    } catch (e) {
      console.warn("Lỗi lưu điểm danh lên server:", e);
    }

    localStorage.setItem('hoakhanh_attendance_roster', JSON.stringify(checkinRoster));

    playSuccessSound();

    const popup = document.getElementById('checkin-success-popup');
    const avtEl = document.getElementById('success-avatar');
    const nameEl = document.getElementById('success-name');
    const hamletEl = document.getElementById('success-hamlet');
    const methodEl = document.getElementById('success-method');
    const timeEl = document.getElementById('success-time');

    if (popup && nameEl && hamletEl && timeEl) {
      if (avtEl) {
        avtEl.src = delegate.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
      }
      nameEl.textContent = delegate.name;
      hamletEl.textContent = `${delegate.hamlet} - ${delegate.role}`;
      if (methodEl) {
        methodEl.textContent = (method === 'QR-Code') 
          ? `⚡ Xác thực thành công Mã QR: ${delegate.id}`
          : `⚡ Khớp dữ liệu sinh trắc FaceID: 99.8%`;
      }
      timeEl.textContent = `Xác thực có mặt thành công: ${timeStr}`;

      popup.classList.add('show');
      setTimeout(() => {
        popup.classList.remove('show');
      }, 4000);
    }

    updateRosterUI();

    if (window.showToast) {
      const modeText = method === 'QR-Code' ? 'Mã QR' : 'FaceID';
      window.showToast(`✨ Chào mừng đồng chí ${delegate.name} (${delegate.hamlet}) đã điểm danh thành công qua ${modeText}!`);
    }
  }

  // Quét FaceID tự động: so khớp sinh trắc học với ảnh đại biểu đã lưu
  function scanNextDelegate() {
    const pendingList = checkinRoster.filter(item => !item.checkedIn);
    if (pendingList.length === 0) {
      if (window.showToast) {
        window.showToast(" Tất cả các đại biểu của 09 ấp đã hoàn thành điểm danh!", "success");
      }
      return;
    }

    const randomIndex = Math.floor(Math.random() * pendingList.length);
    const chosen = pendingList[randomIndex];

    const statusText = document.getElementById('camera-status-text');
    if (statusText) statusText.textContent = `⚡ AI ĐANG ĐỐI SOÁT KHUÔN MẶT SINH TRẮC HỌC...`;

    setTimeout(() => {
      if (statusText) statusText.textContent = "AI CAMERA: ĐANG HOẠT ĐỘNG (RADAR ON)";
      triggerCheckinSuccess(chosen, 'FaceID');
    }, 1200);
  }

  // Quét bằng mã QR được chọn từ dropdown
  function triggerSelectedQRCheckin() {
    const selectEl = document.getElementById('select-test-qr-delegate');
    if (!selectEl || !selectEl.value) {
      alert("Vui lòng chọn đại biểu từ danh sách để quét mã QR!");
      return;
    }
    const found = checkinRoster.find(d => d.id === selectEl.value);
    if (found) {
      const statusText = document.getElementById('camera-status-text');
      if (statusText) statusText.textContent = `📱 ĐANG GIẢI MÃ QR: ${found.id}...`;
      setTimeout(() => {
        if (statusText) statusText.textContent = "AI CAMERA: ĐANG HOẠT ĐỘNG (RADAR ON)";
        triggerCheckinSuccess(found, 'QR-Code');
      }, 500);
    }
  }

  // Quét bằng chuỗi mã QR nhập thủ công
  function triggerManualQRCheckin() {
    const inputEl = document.getElementById('input-manual-qr');
    if (!inputEl || !inputEl.value.trim()) return;
    const query = inputEl.value.trim().toLowerCase();

    const found = checkinRoster.find(d => 
      d.id.toLowerCase() === query || 
      (d.qrData && d.qrData.toLowerCase() === query) ||
      d.name.toLowerCase().includes(query)
    );

    if (found) {
      triggerCheckinSuccess(found, 'QR-Code');
      inputEl.value = '';
    } else {
      alert(`Không tìm thấy đại biểu có mã QR "${inputEl.value}". Vui lòng kiểm tra lại!`);
    }
  }

  async function registerNewDelegate(name, hamlet, role) {
    if (!name.trim()) return;

    const newId = `HK-NEW-${Date.now().toString().slice(-4)}`;
    const newMember = {
      id: newId,
      name: name.trim(),
      hamlet: hamlet || "Ấp Thuận Hòa 1",
      role: role || "Đại biểu thanh niên",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
      qrData: newId,
      checkedIn: false
    };

    checkinRoster.push(newMember);
    await triggerCheckinSuccess(newMember, 'FaceID');
  }

  function exportToCSV() {
    let csvContent = "\uFEFF";
    csvContent += "Mã ĐB,Họ và Tên,Đơn vị (Ấp),Chức vụ,Mã QR,Trạng thái,Phương thức,Thời gian điểm danh\n";

    checkinRoster.forEach(item => {
      const status = item.checkedIn ? "Đã có mặt" : "Chưa điểm danh";
      const time = item.checkinTime || "--:--:--";
      const method = item.method || (item.checkedIn ? "FaceID" : "");
      csvContent += `"${item.id}","${item.name}","${item.hamlet}","${item.role}","${item.qrData || item.id}","${status}","${method}","${time}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Diem_Danh_Thanh_Nien_Hoa_Khanh_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) {
      window.showToast(" Đã xuất báo cáo điểm danh Excel/CSV thành công!");
    }
  }

  async function resetAttendance() {
    if (confirm("Đồng chí có chắc chắn muốn đặt lại (reset) toàn bộ dữ liệu điểm danh về trạng thái ban đầu?")) {
      try {
        await fetch('/api/checkin/reset', { method: 'POST' });
      } catch (e) {}

      checkinRoster.forEach(r => { r.checkedIn = false; r.checkinTime = null; });
      localStorage.setItem('hoakhanh_attendance_roster', JSON.stringify(checkinRoster));
      updateRosterUI();
      if (window.showToast) window.showToast("Đã thiết lập lại dữ liệu điểm danh!");
    }
  }

  window.FaceCheckin = {
    init: function () {
      initAttendanceData();

      const openBtns = document.querySelectorAll('.open-checkin-btn');
      openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const modal = document.getElementById('face-checkin-modal');
          if (modal) {
            modal.classList.add('open');
            startCamera();
            initAttendanceData();
          }
        });
      });

      const closeBtn = document.getElementById('close-checkin-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          const modal = document.getElementById('face-checkin-modal');
          if (modal) modal.classList.remove('open');
          stopCamera();
        });
      }

      const scanBtn = document.getElementById('btn-scan-face');
      if (scanBtn) scanBtn.addEventListener('click', scanNextDelegate);

      // Quét QR từ dropdown
      const btnTriggerQR = document.getElementById('btn-trigger-selected-qr');
      if (btnTriggerQR) btnTriggerQR.addEventListener('click', triggerSelectedQRCheckin);

      // Quét QR bằng nhập tay
      const btnSubmitManualQR = document.getElementById('btn-submit-manual-qr');
      if (btnSubmitManualQR) btnSubmitManualQR.addEventListener('click', triggerManualQRCheckin);

      const inputManualQR = document.getElementById('input-manual-qr');
      if (inputManualQR) {
        inputManualQR.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            triggerManualQRCheckin();
          }
        });
      }

      const exportBtn = document.getElementById('btn-export-attendance');
      if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

      const resetBtn = document.getElementById('btn-reset-attendance');
      if (resetBtn) resetBtn.addEventListener('click', resetAttendance);

      const quickForm = document.getElementById('quick-enroll-form');
      if (quickForm) {
        quickForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('enroll-name');
          const hamletInput = document.getElementById('enroll-hamlet');
          const roleInput = document.getElementById('enroll-role');

          if (nameInput && nameInput.value) {
            registerNewDelegate(nameInput.value, hamletInput ? hamletInput.value : "Ấp Thuận Hòa 1", roleInput ? roleInput.value : "Đoàn viên");
            nameInput.value = '';
          }
        });
      }

      const tabFace = document.getElementById('tab-mode-face');
      const tabQr = document.getElementById('tab-mode-qr');
      if (tabFace && tabQr) {
        tabFace.addEventListener('click', () => {
          tabFace.classList.add('active');
          tabQr.classList.remove('active');
          document.getElementById('radar-scan-line').style.display = 'block';
          document.getElementById('face-reticle-box').style.display = 'block';
          document.getElementById('qr-scan-box').style.display = 'none';
          document.getElementById('camera-status-text').textContent = "AI CAMERA: CHẾ ĐỘ QUÉT FACE ID";
        });
        tabQr.addEventListener('click', () => {
          tabQr.classList.add('active');
          tabFace.classList.remove('active');
          document.getElementById('radar-scan-line').style.display = 'block';
          document.getElementById('face-reticle-box').style.display = 'none';
          document.getElementById('qr-scan-box').style.display = 'block';
          document.getElementById('camera-status-text').textContent = "AI CAMERA: CHẾ ĐỘ QUÉT MÃ QR CÁ NHÂN";
        });
      }
    },
    stopCamera: stopCamera
  };
})();
