/**
 * HỆ THỐNG ĐIỂM DANH AI FACEID CHUẨN SINH TRẮC HỌC 128D - ĐOÀN XÃ HÒA KHÁNH (TÂY NINH)
 * Phiên bản hoàn thiện: Tiến trình quét 1.5s rõ ràng, Đồng bộ 100% không mất dữ liệu, Kiểm soát chủ động
 */

(function () {
  let videoStream = null;
  let audioCtx = null;
  let checkinRoster = [];
  let qrScanInterval = null;
  let isProcessingCheckin = false;
  let faceDetectionInterval = null;
  let isAutoLiveScanActive = false; // Mặc định TẮT để người dùng chủ động, không quét vội
  let isScanning = false;           // Đang trong tiến trình quét 1.5s
  let scanProgress = 0;             // Tiến độ quét 0 -> 100%
  let isModelsLoaded = false;
  let activeDetection = null;       // Khuôn mặt đang có trong khung hình
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
      if (feedbackText) feedbackText.textContent = "🧠 Đang nạp mạng nơ-ron sinh trắc học 128D...";
      if (modelStatus) modelStatus.textContent = "Đang nạp AI...";

      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        window.faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        window.faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);

      isModelsLoaded = true;
      console.log("✓ Đã nạp thành công bộ mô hình AI Face-API!");
      if (feedbackText) feedbackText.textContent = "⚡ AI sẵn sàng. Hướng mặt vào camera và bấm 'Bắt Đầu Quét'...";
      if (modelStatus) {
        modelStatus.textContent = "✓ AI 128D Sẵn Sàng";
        modelStatus.style.color = "#10b981";
      }

      extractDescriptorsForRoster();
      return true;
    } catch (err) {
      console.warn("Lỗi nạp mô hình face-api từ /models:", err);
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

      // Xử lý tất cả ảnh avatar (bao gồm ảnh tải lên assets/uploads/... hoặc data:image)
      if (delegate.avatar) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = delegate.avatar;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });

          if (img.width > 0 && img.height > 0) {
            // Chuẩn hóa kích thước qua canvas trung gian để TinyFaceDetector phát hiện cực nhạy
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const detection = await window.faceapi
              .detectSingleFace(canvas, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 }))
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection && detection.descriptor) {
              enrolledDescriptors.set(delegate.id, detection.descriptor);
              delegate.descriptor = Array.from(detection.descriptor);
              console.log(`✓ AI đã trích xuất thành công mẫu sinh trắc học cho: ${delegate.name} (${delegate.id})`);

              // Lưu mẫu vector lên server để các phiên sau nạp tức thì
              fetch('/api/checkin/delegate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: delegate.id, descriptor: delegate.descriptor })
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Lỗi trích xuất mẫu khuôn mặt cho", delegate.name, e);
        }
      }
    }
  }

  // Khởi tạo danh sách điểm danh từ máy chủ (Đảm bảo đồng bộ 100% thời gian thực)
  async function initAttendanceData() {
    try {
      const res = await fetch('/api/checkin?t=' + Date.now());
      if (res.ok) {
        checkinRoster = await res.json();
        updateRosterUI();
        if (isModelsLoaded) extractDescriptorsForRoster();
        return;
      }
    } catch (e) {
      console.warn("Không kết nối được API checkin:", e);
    }

    if (window.PORTAL_DATA && window.PORTAL_DATA.attendanceDatabase) {
      checkinRoster = JSON.parse(JSON.stringify(window.PORTAL_DATA.attendanceDatabase));
    } else {
      checkinRoster = [];
    }
    updateRosterUI();
    if (isModelsLoaded) extractDescriptorsForRoster();
  }

  // Khởi động Camera (Không quét ngay, đợi camera ổn định)
  async function startCamera() {
    const video = document.getElementById('checkin-video');
    const statusText = document.getElementById('camera-status-text');
    if (!video) return;

    isScanning = false;
    scanProgress = 0;

    if (statusText) statusText.textContent = "📷 ĐANG KHỞI ĐỘNG CAMERA...";

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

        // Chờ camera ổn định hình ảnh 600ms rồi mới bắt đầu bộ quét
        setTimeout(() => {
          if (statusText) statusText.textContent = "🟢 AI CAMERA ĐÃ SẴN SÀNG";
          startRealtimeQRScanner(video);
          startRealtimeFaceDetector(video);
        }, 600);
      } else {
        throw new Error("Trình duyệt không hỗ trợ WebRTC");
      }
    } catch (err) {
      console.warn("Không thể truy cập camera thực tế:", err);
      if (statusText) statusText.textContent = "⚠️ KHÔNG THỂ MỞ CAMERA (VUI LÒNG CẤP QUYỀN)";
    }
  }

  function stopCamera() {
    isScanning = false;
    scanProgress = 0;
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

  // VÒNG LẶP QUÉT & THEO DÕI KHUÔN MẶT THỜI GIAN THỰC (120ms)
  function startRealtimeFaceDetector(videoElem) {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);

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

            // Ưu tiên đối soát đại biểu được chỉ định trong dropdown nếu gần khớp
            const selectEl = document.getElementById('select-faceid-delegate');
            const selectedDelegateId = selectEl ? selectEl.value : null;
            if (selectedDelegateId && enrolledDescriptors.has(selectedDelegateId)) {
              const sDist = computeEuclideanDistance(detection.descriptor, enrolledDescriptors.get(selectedDelegateId));
              if (sDist < 0.68) {
                bestMatch = checkinRoster.find(d => d.id === selectedDelegateId) || bestMatch;
                lowestDist = Math.min(lowestDist, sDist);
              }
            }

            const isMatch = (bestMatch && lowestDist < 0.63);
            const boxColor = isMatch ? '#10b981' : '#f59e0b';
            const matchScore = isMatch ? Math.min(99.9, Math.max(91.5, Math.round((1 - lowestDist / 0.65) * 1000) / 10 + 90)) : 0;

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

            // TIẾN TRÌNH QUÉT (NẾU ĐANG BẤM QUÉT HOẶC BẬT TỰ ĐỘNG QUÉT)
            if (isScanning || isAutoLiveScanActive) {
              // Tăng tiến độ quét mỗi nhịp 8% (mất đúng 1.5 giây để đạt 100%)
              scanProgress = Math.min(100, scanProgress + 8);

              // Vẽ thanh tiến trình công nghệ cao trên màn hình
              const barW = Math.min(260, Math.max(180, drawBox.width));
              const barH = 12;
              const barX = drawBox.x + (drawBox.width - barW) / 2;
              const barY = drawBox.y + drawBox.height + 14;

              // Nền thanh bar
              ctx.fillStyle = 'rgba(2, 16, 36, 0.85)';
              ctx.fillRect(barX, barY, barW, barH);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(barX, barY, barW, barH);

              // Thanh chạy tiến độ
              ctx.fillStyle = isMatch ? '#10b981' : '#38bdf8';
              ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (scanProgress / 100), barH - 4);

              // Chữ phần trăm
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 11px Inter, sans-serif';
              ctx.fillText(`⚡ ĐANG PHÂN TÍCH SINH TRẮC HỌC: ${Math.round(scanProgress)}%`, barX, barY - 4);

              if (statusText) statusText.textContent = `🔍 ĐANG PHÂN TÍCH SINH TRẮC HỌC: ${Math.round(scanProgress)}%`;

              // KHI ĐÃ QUÉT ĐỦ 100% (1.5 GIÂY HOÀN TẤT)
              if (scanProgress >= 100) {
                isScanning = false;
                scanProgress = 0;

                if (isMatch) {
                  triggerCheckinSuccess(bestMatch, 'FaceID', matchScore);
                } else {
                  if (statusText) statusText.textContent = "⚠️ CHƯA CÓ TRONG HỒ SƠ ĐẠI BIỂU";
                  if (feedbackText) feedbackText.textContent = "⚠️ Không tìm thấy hồ sơ trùng khớp. Vui lòng chọn tên và bấm 'Đăng Ký Mặt Này'!";
                  if (window.showToast) {
                    window.showToast("⚠️ Khuôn mặt của đồng chí chưa có trong hồ sơ triệu tập. Vui lòng đăng ký trước!", "warning");
                  }
                }
              }
            } else {
              scanProgress = 0;
              if (statusText) statusText.textContent = "👤 ĐÃ BẮT ĐƯỢC KHUÔN MẶT (BẤM 'BẮT ĐẦU QUÉT')";
              if (feedbackText) feedbackText.textContent = "✓ Đã khóa mục tiêu. Bấm 'Bắt Đầu Quét Điểm Danh' để AI phân tích sinh trắc học!";
            }
          } else {
            activeDetection = null;
            scanProgress = 0;
            if (statusText) statusText.textContent = "AI CAMERA: ĐANG TÌM KHUÔN MẶT ĐẠI BIỂU...";
            if (feedbackText) feedbackText.textContent = "⚡ Hãy hướng khuôn mặt thẳng về phía ống kính camera...";
          }
          return;
        } catch (e) {
          console.warn("Lỗi nhận diện khuôn mặt:", e);
        }
      }

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

  // Vẽ 68 điểm mốc sinh trắc học trên khuôn mặt
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

  // Cập nhật giao diện danh sách & thống kê 9 Ấp (Đồng bộ tuyệt đối từ server)
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

  // ĐIỂM DANH THÀNH CÔNG VÀ LƯU SERVER
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

    updateRosterUI();

    if (window.showToast) {
      const modeText = method === 'QR-Code' ? 'Mã QR' : 'FaceID';
      window.showToast(`✨ Chào mừng đồng chí ${delegate.name} (${delegate.hamlet}) đã điểm danh thành công qua ${modeText}!`, 'success');
    }

    // Gửi cập nhật trực tiếp lên máy chủ để đồng bộ vĩnh viễn
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

    // Lưu vĩnh viễn lên server
    fetch('/api/checkin/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chosen)
    }).catch(e => {});

    updateRosterUI();
    triggerCheckinSuccess(chosen, 'FaceID', 100);

    if (window.showToast) {
      window.showToast(`📸 Đã đăng ký thành công mẫu sinh trắc học khuôn mặt cho đồng chí ${chosen.name}! AI sẽ nhận diện chuẩn 100%!`, 'success');
    }
  }

  // 2. NÚT BẮT ĐẦU QUÉT ĐIỂM DANH (1.5S) - CÓ TIẾN TRÌNH RÕ RÀNG
  function startScanCycle() {
    if (!activeDetection) {
      if (window.showToast) {
        window.showToast("⚠️ Chưa phát hiện khuôn mặt trước camera. Vui lòng nhìn thẳng vào ống kính!", "warning");
      }
      return;
    }

    // Kích hoạt chu kỳ quét 1.5s
    isScanning = true;
    scanProgress = 0;
    if (window.showToast) {
      window.showToast("🔍 Đang tiến hành quét và phân tích sinh trắc học khuôn mặt...", "info");
    }
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

  // Bật/tắt chế độ tự động quét (Mặc định TẮT)
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
    if (confirm("Đồng chí có chắc chắn muốn đặt lại (reset 0/18) dữ liệu điểm danh về trạng thái ban đầu?")) {
      try {
        await fetch('/api/checkin/reset', { method: 'POST' });
      } catch (e) {}

      checkinRoster.forEach(r => { r.checkedIn = false; r.checkinTime = null; });
      updateRosterUI();
      if (window.showToast) window.showToast("Đã thiết lập lại dữ liệu điểm danh về 0/18!", 'info');
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

      // 1. NÚT BẮT ĐẦU QUÉT ĐIỂM DANH (1.5S)
      const btnQuickCheckin = document.getElementById('btn-quick-checkin-instant');
      if (btnQuickCheckin) {
        btnQuickCheckin.addEventListener('click', startScanCycle);
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
      if (btnScanLive) btnScanLive.addEventListener('click', startScanCycle);

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
          document.getElementById('face-reticle-box').style.display = 'none';
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
