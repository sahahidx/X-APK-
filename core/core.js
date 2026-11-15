const Core = {
  ls: {
    get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  },
  theme() { document.documentElement.dataset.t = Core.ls.get('theme', 'dark'); },
  toggle() { Core.ls.set('theme', Core.ls.get('theme', 'dark') === 'dark' ? 'light' : 'dark'); Core.theme(); },
  async save(blob, name) {
    const P = window.Capacitor && Capacitor.Plugins;
    if (P && P.Filesystem) {
      const b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
      const res = await P.Filesystem.writeFile({ path: 'UtilityApp/' + name, data: b64, directory: 'DOCUMENTS', recursive: true });
      alert('Saved: Documents/UtilityApp/' + name);
      try { if (P.Share) await P.Share.share({ url: res.uri }); } catch (e) {}
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    }
  },
  async tgSync() {
    if (!navigator.onLine) return alert('Offline: sync skipped');
    let c = Core.ls.get('tg');
    if (!c) {
      const t = prompt('Telegram bot token'), id = prompt('Chat ID');
      if (!t || !id) return;
      c = { t, id }; Core.ls.set('tg', c);
    }
    const fd = new FormData();
    fd.append('chat_id', c.id);
    fd.append('document', new Blob([JSON.stringify(localStorage)]), 'utility-backup.json');
    try {
      const r = await fetch('https://api.telegram.org/bot' + c.t + '/sendDocument', { method: 'POST', body: fd });
      alert(r.ok ? 'Backup sent to Telegram' : 'Sync failed');
    } catch (e) { alert('Sync failed'); }
  },
  async record(v, o) {
    const ac = new AudioContext(), s = ac.createMediaElementSource(v), d = ac.createMediaStreamDestination();
    s.connect(d);
    const tr = [...d.stream.getAudioTracks()], st = o.start || 0, en = o.end || v.duration;
    let cv, x;
    if (!o.audio) {
      cv = document.createElement('canvas'); cv.width = o.w; cv.height = o.h; x = cv.getContext('2d');
      tr.push(...cv.captureStream(30).getVideoTracks());
    }
    const mt = o.audio ? 'audio/webm;codecs=opus' : 'video/webm;codecs=vp8,opus';
    const rc = new MediaRecorder(new MediaStream(tr), { mimeType: mt, videoBitsPerSecond: o.bps, audioBitsPerSecond: 96000 });
    const ch = []; rc.ondataavailable = e => e.data.size && ch.push(e.data);
    if (Math.abs(v.currentTime - st) > 0.05) { v.currentTime = st; await new Promise(r => v.addEventListener('seeked', r, { once: true })); }
    return new Promise(res => {
      rc.onstop = () => { ac.close(); res(new Blob(ch, { type: mt.split(';')[0] })); };
      const tick = () => {
        if (x) x.drawImage(v, 0, 0, o.w, o.h);
        if (o.onp) o.onp((v.currentTime - st) / (en - st));
        if (v.currentTime >= en || v.ended) { v.pause(); rc.stop(); return; }
        requestAnimationFrame(tick);
      };
      rc.start(500); v.play(); tick();
    });
  }
};
Core.theme();
