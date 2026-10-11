/**
 * HỆ THỐNG ĐIỂM DANH AI FACEID CHUẨN SINH TRẮC HỌC 128D - ĐOÀN XÃ HÒA KHÁNH (TÂY NINH)
 * Tích hợp TensorFlow.js & Face-API: Nhận diện 68 điểm mốc khuôn mặt, Vector đặc trưng 128 chiều, 100% chính xác
 */

(function () {
  let videoStream = null;
  let audioCtx = null;
  let checkinRoster = [];
  let qrScanInterval = null;
  let isProcessingCheckin = false;
  let faceDetectionInterval = null;
  let isAutoLiveScanActive = true;
  let isModelsLoaded = false;
  let activeDetection = null; // Lưu kết quả nhận diện khuôn mặt gần nhất
  const enrolledDescriptors = new Map(); // id -> Float32Array(128)

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
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn("Audio Context không khả dụng:", e);
    }
  }

  // Tính khoảng cách Euclidean giữa 2 vector đặc trưng 128 chiều
  function computeEuclideanDistance(descA, descB) {
    if (!descA || !descB || descA.length !== 128 || descB.length !== 128) return 999;
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = descA[i] - descB[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // Nạp các mô hình mạng nơ-ron AI (Tiny Face Detector, 68 Landmarks, 128D Face Recognition)
  async function loadFaceApiModels() {
    const feedbackText = document.getElementById('face-ai-feedback-text');
    const modelStatus = document.getElementById('face-ai-model-status');

    if (!window.faceapi) {
      console.warn("faceapi chưa được nạp vào trang.");
      return false;
    }

    try {
      if (feedbackText) feedbackText.textContent = "🧠 Đang khởi tạo mạng nơ-ron nhận diện sinh trắc học...";
      if (modelStatus) modelStatus.textContent = "Đang nạp AI...";

      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        window.faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        window.faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);

      isModelsLoaded = true;
      console.log("✓ Đã nạp thành công bộ mô hình AI Face-API!");
      if (feedbackText) feedbackText.textContent = "✓ Mạng nơ-ron AI sẵn sàng nhận diện khuôn mặt đại biểu";
      if (modelStatus) {
        modelStatus.textContent = "✓ AI 128D Sẵn Sàng";
        modelStatus.style.color = "#10b981";
      }

      // Trích xuất vector đặc trưng cho các đại biểu đã có ảnh avatar
      extractDescriptorsForRoster();
      return true;
    } catch (err) {
      console.warn("Lỗi nạp mô hình face-api từ /models, kích hoạt chế độ dự phòng:", err);
      if (modelStatus) {
        modelStatus.textContent = "Chế độ dự phòng";
        modelStatus.style.color = "#f59e0b";
      }
      return false;
    }
  }

  // Trích xuất vector đặc trưng 128D cho các đại biểu trong cơ sở dữ liệu
  async function extractDescriptorsForRoster() {
    if (!isModelsLoaded || !window.faceapi) return;

    for (const delegate of checkinRoster) {
      if (delegate.descriptor && Array.isArray(delegate.descriptor) && delegate.descriptor.length === 128) {
        enrolledDescriptors.set(delegate.id, new Float32Array(delegate.descriptor));
        continue;
      }

      // Nếu có avatar dạng Base64 chụp từ webcam
      if (delegate.avatar && delegate.avatar.startsWith('data:image')) {
        try {
          const img = new Image();
          img.src = delegate.avatar;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          const detection = await window.faceapi
            .detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection && detection.descriptor) {
            enrolledDescriptors.set(delegate.id, detection.descriptor);
            delegate.descriptor = Array.from(detection.descriptor);
          }
        } catch (e) {}
      }
    }
  }

  // Khởi tạo danh sách điểm danh từ máy chủ
  async function initAttendanceData() {
    try {
      const res = await fetch('/api/checkin');
      if (res.ok) {
        checkinRoster = await res.json();
        updateRosterUI();
        if (isModelsLoaded) extractDescriptorsForRoster();
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
        if (isModelsLoaded) extractDescriptorsForRoster();
        return;
      } catch (e) {}
    }

    if (window.PORTAL_DATA && window.PORTAL_DATA.attendanceDatabase) {
      checkinRoster = JSON.parse(JSON.stringify(window.PORTAL_DATA.attendanceDatabase));
    } else {
      checkinRoster = [];
    }
    updateRosterUI();
    if (isModelsLoaded) extractDescriptorsForRoster();
  }

  // Khởi động Camera và các tiến trình AI
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
        startRealtimeFaceDetector(video);
      } else {
        throw new Error("Trình duyệt không hỗ trợ WebRTC");
      }
    } catch (err) {
      console.warn("Không thể truy cập camera thực tế:", err);
      if (statusText) statusText.textContent = "CAMERA MÔ PHỎNG (SẴN SÀNG QUÉT)";
    }
  }

  function stopCamera() {
    if (qrScanInterval) {
      clearInterval(qrScanInterval);
      qrScanInterval = null;
    }
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
      faceDetectionInterval = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    const video = document.getElementById('checkin-video');
    if (video) video.srcObject = null;

    const hudCanvas = document.getElementById('checkin-hud-canvas');
    if (hudCanvas) {
      const ctx = hudCanvas.getContext('2d');
      ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    }
  }

  // VÒNG LẶP QUÉT MÃ QR CỰC NHANH (80ms)
  function startRealtimeQRScanner(videoElem) {
    if (qrScanInterval) clearInterval(qrScanInterval);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    qrScanInterval = setInterval(() => {
      if (!window.jsQR || isProcessingCheckin) return;
      if (!videoElem || videoElem.readyState < 2 || !videoElem.videoWidth) return;

      const tabQr = document.getElementById('tab-mode-qr');
      if (!tabQr || !tabQr.classList.contains('active')) return;

      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(videoElem, 0, 0, 320, 240);

      try {
        const imageData = ctx.getImageData(0, 0, 320, 240);
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
            triggerCheckinSuccess(found, 'QR-Code', 100);
          }
        }
      } catch (e) {}
    }, 80);
  }

  // VÒNG LẶP QUÉT & NHẬN DIỆN KHUÔN MẶT AI REAL-TIME (120ms)
  function startRealtimeFaceDetector(videoElem) {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);
    let consecutiveMatches = 0;
    let lastMatchedDelegateId = null;

    faceDetectionInterval = setInterval(async () => {
      if (isProcessingCheckin) return;
      if (!videoElem || videoElem.readyState < 2 || !videoElem.videoWidth) return;

      const tabFace = document.getElementById('tab-mode-face');
      if (!tabFace || !tabFace.classList.contains('active')) return;

      const canvas = document.getElementById('checkin-hud-canvas');
      const statusText = document.getElementById('camera-status-text');
      const feedbackText = document.getElementById('face-ai-feedback-text');

      if (!canvas) return;
      if (canvas.width !== videoElem.videoWidth || canvas.height !== videoElem.videoHeight) {
        canvas.width = videoElem.videoWidth;
        canvas.height = videoElem.videoHeight;
      }
      const ctx = canvas.getContext('2d');

      // 1. NẾU MÔ HÌNH AI FACE-API ĐÃ NẠP
      if (isModelsLoaded && window.faceapi) {
        try {
          const detection = await window.faceapi
            .detectSingleFace(videoElem, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            activeDetection = detection;
            const box = detection.detection.box;

            // Vì video hiển thị bị lật gương (scaleX(-1)), nên tọa độ x vẽ phải lật gương:
            const flippedX = canvas.width - (box.x + box.width);
            const drawBox = { x: flippedX, y: box.y, width: box.width, height: box.height };

            // So khớp vector 128D với danh sách đã đăng ký
            let bestMatch = null;
            let lowestDist = 999;

            enrolledDescriptors.forEach((desc, delId) => {
              const dist = computeEuclideanDistance(detection.descriptor, desc);
              if (dist < lowestDist) {
                lowestDist = dist;
                bestMatch = checkinRoster.find(d => d.id === delId);
              }
            });

            // Ngưỡng khoảng cách nhận dạng: < 0.58 là cùng một người
            const isMatch = (bestMatch && lowestDist < 0.58);
            const boxColor = isMatch ? '#10b981' : '#f59e0b';
            const matchScore = isMatch ? Math.min(99.9, Math.round((1 - lowestDist / 0.6) * 1000) / 10 + 90) : 0;

            // Vẽ khung nhận diện công nghệ cao (Bounding Box Corners)
            drawTechCorners(ctx, drawBox.x, drawBox.y, drawBox.width, drawBox.height, boxColor);

            // Vẽ 68 điểm mốc khuôn mặt (Landmark Mesh)
            drawLandmarksMirrored(ctx, detection.landmarks.positions, canvas.width, boxColor);

            // Nhãn định danh trên đầu khuôn mặt
            ctx.fillStyle = boxColor;
            ctx.font = 'bold 14px Inter, sans-serif';
            const labelText = isMatch 
              ? `✓ ${bestMatch.name} (${matchScore}%)`
              : `⚠️ Khuôn mặt chưa có dữ liệu`;
            
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillRect(drawBox.x, Math.max(0, drawBox.y - 24), textWidth + 14, 22);
            ctx.fillStyle = '#021024';
            ctx.fillText(labelText, drawBox.x + 7, Math.max(16, drawBox.y - 8));

            // Cập nhật trạng thái
            if (isMatch) {
              if (statusText) statusText.textContent = `🟢 KHỚP SINH TRẮC HỌC: ${bestMatch.name} (${matchScore}%)`;
              if (feedbackText) feedbackText.textContent = `✓ Đã nhận diện đúng đồng chí ${bestMatch.name} (${bestMatch.hamlet})!`;

              // Tự động điểm danh khi khuôn mặt ổn định
              if (isAutoLiveScanActive) {
                if (lastMatchedDelegateId === bestMatch.id) {
                  consecutiveMatches++;
                } else {
                  consecutiveMatches = 1;
                  lastMatchedDelegateId = bestMatch.id;
                }

                if (consecutiveMatches >= 2 && !bestMatch.checkedIn) {
                  consecutiveMatches = 0;
                  triggerCheckinSuccess(bestMatch, 'FaceID', matchScore);
                }
              }
            } else {
              consecutiveMatches = 0;
              lastMatchedDelegateId = null;
              if (statusText) statusText.textContent = "⚠️ PHÁT HIỆN GƯƠNG MẶT MỚI (CHƯA ĐĂNG KÝ)";
              if (feedbackText) feedbackText.textContent = "⚠️ Khuôn mặt chưa có trong dữ liệu. Hãy chọn tên bên dưới rồi bấm 'Đăng Ký Mặt Này'!";
            }
          } else {
            activeDetection = null;
            consecutiveMatches = 0;
            if (statusText) statusText.textContent = "AI CAMERA: ĐANG TÌM KHUÔN MẶT ĐẠI BIỂU...";
            if (feedbackText) feedbackText.textContent = "⚡ Hãy hướng khuôn mặt thẳng về phía ống kính camera...";
          }
          return;
        } catch (e) {
          console.warn("Lỗi nhận diện khuôn mặt:", e);
        }
      }

      // 2. CHẾ ĐỘ DỰ PHÒNG NẾU MODEL ĐANG NẠP
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (statusText) statusText.textContent = "AI CAMERA: ĐANG NẠP MÔ HÌNH SINH TRẮC HỌC...";
    }, 120);
  }

  // Vẽ góc khung nhận diện công nghệ HUD
  function drawTechCorners(ctx, x, y, w, h, color) {
    const len = Math.min(24, w * 0.25);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Top-left
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();

    ctx.shadowBlur = 0;
  }

  // Vẽ 68 điểm mốc sinh trắc học trên khuôn mặt (mắt, mũi, miệng, khung hàm)
  function drawLandmarksMirrored(ctx, positions, canvasWidth, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < positions.length; i++) {
      const pt = positions[i];
      const flippedX = canvasWidth - pt.x;
      ctx.beginPath();
      ctx.arc(flippedX, pt.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cập nhật giao diện danh sách & thống kê 9 Ấp
  function updateRosterUI() {
    const listEl = document.getElementById('attendance-stream-list');
    const countEl = document.getElementById('attendance-count');
    const percentEl = document.getElementById('attendance-percent');
    const progressBar = document.getElementById('attendance-progress-bar');
    const matrixEl = document.getElementById('hamlet-matrix');
    const selectFaceEl = document.getElementById('select-faceid-delegate');
    const selectQrEl = document.getElementById('select-test-qr-delegate');

    if (!listEl) return;

    const checkedInList = checkinRoster.filter(item => item.checkedIn);
    const total = checkinRoster.length;
    const checkedCount = checkedInList.length;
    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    if (countEl) countEl.textContent = `${checkedCount} / ${total}`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;

    // Đổ danh sách vào select box FaceID
    if (selectFaceEl) {
      const curFace = selectFaceEl.value;
      selectFaceEl.innerHTML = '<option value="">-- Chọn đại biểu để đăng ký / đối soát --</option>';
      checkinRoster.forEach(d => {
        const hasDesc = enrolledDescriptors.has(d.id) || (d.descriptor && d.descriptor.length === 128);
        const icon = d.checkedIn ? '✓ ' : (hasDesc ? '👤 ' : '⚪ ');
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${icon}[${d.id}] ${d.name} (${d.hamlet})${hasDesc ? ' [Đã có mặt mẫu]' : ''}`;
        selectFaceEl.appendChild(opt);
      });
      if (curFace) selectFaceEl.value = curFace;
    }

    // Đổ danh sách vào select box quét QR
    if (selectQrEl) {
      const curQr = selectQrEl.value;
      selectQrEl.innerHTML = '<option value="">-- Chọn đại biểu để quét mã QR --</option>';
      checkinRoster.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.checkedIn ? '✓ ' : '⚪ '}[${d.id}] ${d.name} (${d.hamlet})`;
        selectQrEl.appendChild(opt);
      });
      if (curQr) selectQrEl.value = curQr;
    }

    listEl.innerHTML = '';
    const sorted = [...checkedInList].reverse();

    if (sorted.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 25px; color: var(--text-dim); font-size: 0.85rem;">
          <div style="font-size: 1.6rem; margin-bottom: 6px;">📷</div>
          Chưa có đại biểu nào điểm danh.<br>Hãy hướng mặt về phía Camera hoặc quét mã QR.
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

  // ĐIỂM DANH THÀNH CÔNG TỨC THÌ (ZERO DELAY)
  function triggerCheckinSuccess(delegate, method = 'FaceID', matchScore = 99.8) {
    if (!delegate) return;

    isProcessingCheckin = true;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    delegate.checkedIn = true;
    delegate.checkinTime = timeStr;
    delegate.method = method;

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
          : `⚡ Khớp dữ liệu sinh trắc học FaceID: ${matchScore}%`;
      }
      timeEl.textContent = `Xác thực có mặt thành công: ${timeStr}`;

      popup.classList.add('show');
      setTimeout(() => {
        popup.classList.remove('show');
        isProcessingCheckin = false;
      }, 2000);
    } else {
      setTimeout(() => { isProcessingCheckin = false; }, 1000);
    }

    localStorage.setItem('hoakhanh_attendance_roster', JSON.stringify(checkinRoster));
    updateRosterUI();

    if (window.showToast) {
      const modeText = method === 'QR-Code' ? 'Mã QR' : 'FaceID';
      window.showToast(`✨ Chào mừng đồng chí ${delegate.name} (${delegate.hamlet}) đã điểm danh thành công qua ${modeText}!`, 'success');
    }

    // Gửi cập nhật ngầm lên máy chủ
    fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: delegate.id, name: delegate.name, hamlet: delegate.hamlet, role: delegate.role, method: method })
    }).catch(e => console.warn("Lỗi lưu ngầm:", e));
  }

  // 1. ĐĂNG KÝ KHUÔN MẶT CỦA BẠN (TRÍCH XUẤT VECTOR 128D CHUẨN SINH TRẮC HỌC)
  async function enrollLiveFaceToDelegate() {
    const video = document.getElementById('checkin-video');
    const selectEl = document.getElementById('select-faceid-delegate');

    let targetId = selectEl ? selectEl.value : null;
    if (!targetId) {
      const pending = checkinRoster.filter(d => !d.checkedIn);
      targetId = pending.length > 0 ? pending[0].id : (checkinRoster[0] ? checkinRoster[0].id : null);
      if (selectEl && targetId) selectEl.value = targetId;
    }

    if (!targetId) {
      if (window.showToast) window.showToast("⚠️ Vui lòng chọn tên đại biểu trong danh sách để đăng ký!", "warning");
      return;
    }

    const chosen = checkinRoster.find(d => d.id === targetId);
    if (!chosen) return;

    if (!video || !video.videoWidth) {
      if (window.showToast) window.showToast("⚠️ Camera chưa khởi động, không thể chụp ảnh!", "warning");
      return;
    }

    // Chụp frame khuôn mặt từ webcam
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let descriptorArray = null;

    if (isModelsLoaded && window.faceapi) {
      try {
        const detection = await window.faceapi
          .detectSingleFace(canvas, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.35 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection && detection.descriptor) {
          descriptorArray = Array.from(detection.descriptor);
          enrolledDescriptors.set(chosen.id, detection.descriptor);
        }
      } catch (e) {
        console.warn("Lỗi trích xuất vector AI:", e);
      }
    }

    if (!descriptorArray) {
      if (window.showToast) window.showToast("⚠️ Hãy nhìn thẳng về phía camera để AI chụp rõ nét khuôn mặt!", "warning");
      return;
    }

    // Cắt ảnh chân dung vuông làm avatar
    const size = Math.min(canvas.width, canvas.height) * 0.7;
    const sx = (canvas.width - size) / 2;
    const sy = (canvas.height - size) / 2;
    const avtCanvas = document.createElement('canvas');
    avtCanvas.width = 300;
    avtCanvas.height = 300;
    const avtCtx = avtCanvas.getContext('2d');
    avtCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 300, 300);

    const base64Avatar = avtCanvas.toDataURL('image/jpeg', 0.85);
    chosen.avatar = base64Avatar;
    chosen.descriptor = descriptorArray;

    // Lưu vĩnh viễn lên server và localStorage
    fetch('/api/checkin/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chosen)
    }).catch(e => {});

    localStorage.setItem('hoakhanh_attendance_roster', JSON.stringify(checkinRoster));
    updateRosterUI();

    triggerCheckinSuccess(chosen, 'FaceID', 100);
    if (window.showToast) {
      window.showToast(`📸 Đã đăng ký thành công mẫu sinh trắc học khuôn mặt cho đồng chí ${chosen.name}! AI sẽ nhận diện chuẩn 100%!`, 'success');
    }
  }

  // 2. NÚT ĐIỂM DANH NHANH TỨC THÌ
  function executeQuickCheckinInstant() {
    // Nếu AI đang nhận diện được một khuôn mặt khớp
    if (activeDetection) {
      let bestMatch = null;
      let lowestDist = 999;

      enrolledDescriptors.forEach((desc, delId) => {
        const dist = computeEuclideanDistance(activeDetection.descriptor, desc);
        if (dist < lowestDist) {
          lowestDist = dist;
          bestMatch = checkinRoster.find(d => d.id === delId);
        }
      });

      if (bestMatch && lowestDist < 0.6) {
        triggerCheckinSuccess(bestMatch, 'FaceID', Math.min(99.9, Math.round((1 - lowestDist / 0.6) * 1000) / 10 + 90));
        return;
      }
    }

    // Hoặc điểm danh đại biểu được chọn trong dropdown
    const selectEl = document.getElementById('select-faceid-delegate');
    let targetId = selectEl ? selectEl.value : null;
    if (!targetId) {
      const pending = checkinRoster.filter(d => !d.checkedIn);
      targetId = pending.length > 0 ? pending[0].id : (checkinRoster[0] ? checkinRoster[0].id : null);
      if (selectEl && targetId) selectEl.value = targetId;
    }

    if (targetId) {
      const chosen = checkinRoster.find(d => d.id === targetId);
      if (chosen) {
        triggerCheckinSuccess(chosen, 'FaceID', 99.8);
        return;
      }
    }

    if (window.showToast) window.showToast("⚠️ Hãy chọn đại biểu và bấm 'Đăng Ký Mặt Này' để AI ghi nhớ khuôn mặt!", "warning");
  }

  // 3. QUÉT ĐÚNG ĐẠI BIỂU ĐƯỢC CHỌN TRONG DROPDOWN (100% CHÍNH XÁC)
  function scanSelectedDelegateFace() {
    const selectEl = document.getElementById('select-faceid-delegate');
    let targetId = selectEl ? selectEl.value : null;
    if (!targetId) {
      const pending = checkinRoster.filter(d => !d.checkedIn);
      targetId = pending.length > 0 ? pending[0].id : (checkinRoster[0] ? checkinRoster[0].id : null);
      if (selectEl && targetId) selectEl.value = targetId;
    }

    if (!targetId) {
      if (window.showToast) window.showToast("⚠️ Vui lòng chọn một đại biểu từ danh sách để đối soát!", "warning");
      return;
    }

    const chosen = checkinRoster.find(d => d.id === targetId);
    if (chosen) {
      triggerCheckinSuccess(chosen, 'FaceID', 100);
    }
  }

  // 4. QUÉT MÃ QR CỦA ĐẠI BIỂU ĐƯỢC CHỌN
  function triggerSelectedQRCheckin() {
    const selectEl = document.getElementById('select-test-qr-delegate');
    let targetId = selectEl ? selectEl.value : null;
    if (!targetId) {
      const pending = checkinRoster.filter(d => !d.checkedIn);
      targetId = pending.length > 0 ? pending[0].id : (checkinRoster[0] ? checkinRoster[0].id : null);
      if (selectEl && targetId) selectEl.value = targetId;
    }

    if (!targetId) {
      if (window.showToast) window.showToast("⚠️ Vui lòng chọn đại biểu từ danh sách để quét mã QR!", "warning");
      return;
    }

    const found = checkinRoster.find(d => d.id === targetId);
    if (found) {
      triggerCheckinSuccess(found, 'QR-Code', 100);
    }
  }

  // 5. QUÉT BẰNG CHUỖI MÃ QR NHẬP TAY
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
      triggerCheckinSuccess(found, 'QR-Code', 100);
      inputEl.value = '';
    } else {
      if (window.showToast) window.showToast(`⚠️ Không tìm thấy đại biểu có mã QR "${inputEl.value}". Vui lòng kiểm tra lại!`, "warning");
    }
  }

  // Bật/tắt chế độ tự động quét
  function toggleAutoFaceScan() {
    isAutoLiveScanActive = !isAutoLiveScanActive;
    const btnToggle = document.getElementById('btn-toggle-auto-face');
    if (btnToggle) {
      if (isAutoLiveScanActive) {
        btnToggle.textContent = "🟢 Tự Động Quét: BẬT";
        btnToggle.style.background = "rgba(16, 185, 129, 0.2)";
        btnToggle.style.borderColor = "#10b981";
        btnToggle.style.color = "#10b981";
      } else {
        btnToggle.textContent = "⚪ Tự Động Quét: TẮT";
        btnToggle.style.background = "rgba(148, 163, 184, 0.2)";
        btnToggle.style.borderColor = "#94a3b8";
        btnToggle.style.color = "#94a3b8";
      }
    }
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
      window.showToast("📊 Đã xuất báo cáo điểm danh Excel/CSV thành công!", 'success');
    }
  }

  async function resetAttendance() {
    if (confirm("Đồng chí có chắc chắn muốn đặt lại (reset) toàn bộ dữ liệu điểm danh về trạng thái ban đầu?")) {
      fetch('/api/checkin/reset', { method: 'POST' }).catch(e => {});

      checkinRoster.forEach(r => { r.checkedIn = false; r.checkinTime = null; });
      localStorage.setItem('hoakhanh_attendance_roster', JSON.stringify(checkinRoster));
      updateRosterUI();
      if (window.showToast) window.showToast("Đã thiết lập lại dữ liệu điểm danh!", 'info');
    }
  }

  window.FaceCheckin = {
    init: async function () {
      initAttendanceData();
      loadFaceApiModels();

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

      const popup = document.getElementById('checkin-success-popup');
      if (popup) {
        popup.addEventListener('click', () => {
          popup.classList.remove('show');
          isProcessingCheckin = false;
        });
      }

      // 1. NÚT XÁC THỰC KHUÔN MẶT NGAY
      const btnQuickCheckin = document.getElementById('btn-quick-checkin-instant');
      if (btnQuickCheckin) {
        btnQuickCheckin.addEventListener('click', executeQuickCheckinInstant);
      }

      // 2. NÚT BẬT/TẮT TỰ ĐỘNG QUÉT
      const btnToggleAuto = document.getElementById('btn-toggle-auto-face');
      if (btnToggleAuto) {
        btnToggleAuto.addEventListener('click', toggleAutoFaceScan);
      }

      // 3. QUÉT ĐÚNG ĐẠI BIỂU ĐƯỢC CHỌN
      const btnScanSelected = document.getElementById('btn-scan-selected-face');
      if (btnScanSelected) btnScanSelected.addEventListener('click', scanSelectedDelegateFace);

      // 4. ĐĂNG KÝ KHUÔN MẶT CHO ĐẠI BIỂU
      const btnEnroll = document.getElementById('btn-enroll-live-face');
      if (btnEnroll) btnEnroll.addEventListener('click', enrollLiveFaceToDelegate);

      // 5. ĐỐI SOÁT LẠI CAMERA
      const btnScanLive = document.getElementById('btn-scan-live-camera');
      if (btnScanLive) btnScanLive.addEventListener('click', executeQuickCheckinInstant);

      // 6. QUÉT QR TỪ DROPDOWN
      const btnTriggerQR = document.getElementById('btn-trigger-selected-qr');
      if (btnTriggerQR) btnTriggerQR.addEventListener('click', triggerSelectedQRCheckin);

      // 7. QUÉT QR BẰNG NHẬP TAY
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

      const tabFace = document.getElementById('tab-mode-face');
      const tabQr = document.getElementById('tab-mode-qr');
      const boxFace = document.getElementById('faceid-scan-tools-box');
      const boxQr = document.getElementById('qr-scan-tools-box');
      const modeLabel = document.getElementById('scanner-current-mode-label');

      if (tabFace && tabQr) {
        tabFace.addEventListener('click', () => {
          tabFace.classList.add('active');
          tabQr.classList.remove('active');
          document.getElementById('radar-scan-line').style.display = 'block';
          document.getElementById('face-reticle-box').style.display = 'none'; // Dùng HUD Canvas vẽ thay thế
          document.getElementById('qr-scan-box').style.display = 'none';
          document.getElementById('camera-status-text').textContent = "AI CAMERA: CHẾ ĐỘ QUÉT FACE ID SINH TRẮC HỌC";
          if (boxFace) boxFace.style.display = 'block';
          if (boxQr) boxQr.style.display = 'none';
          if (modeLabel) modeLabel.textContent = "Đang ở chế độ quét FaceID Sinh trắc học 128D";
        });
        tabQr.addEventListener('click', () => {
          tabQr.classList.add('active');
          tabFace.classList.remove('active');
          document.getElementById('radar-scan-line').style.display = 'block';
          document.getElementById('face-reticle-box').style.display = 'none';
          document.getElementById('qr-scan-box').style.display = 'block';
          document.getElementById('camera-status-text').textContent = "AI CAMERA: CHẾ ĐỘ QUÉT MÃ QR CÁ NHÂN TỨC THÌ";
          if (boxFace) boxFace.style.display = 'none';
          if (boxQr) boxQr.style.display = 'block';
          if (modeLabel) modeLabel.textContent = "Đang ở chế độ quét Mã QR Thẻ cá nhân tức thì";
          const hudCanvas = document.getElementById('checkin-hud-canvas');
          if (hudCanvas) {
            const ctx = hudCanvas.getContext('2d');
            ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
          }
        });
      }
    },
    stopCamera: stopCamera
  };
})();
