// Minimal static file server for local testing (no external deps).
// Live-reload ในตัว: แก้ไฟล์ใน repo แล้วบันทึก เบราว์เซอร์ที่เปิด localhost:8934 ค้างไว้
// จะ refresh ให้อัตโนมัติ — dev tool เท่านั้น ไม่ถูก deploy ขึ้น Cloudflare (ไฟล์นี้อยู่ใน
// .claude/ ซึ่งไม่ได้เป็นส่วนหนึ่งของเว็บที่ deploy จริง) inject script เข้า index.html
// เฉพาะตอน serve จากเครื่อง dev เท่านั้น ไม่แตะไฟล์ index.html ที่ commit จริง
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = 8934;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ---------- live-reload: Server-Sent Events broadcast ไปทุกแท็บที่เปิดค้างไว้ ----------
const sseClients = [];
function broadcastReload() {
  sseClients.forEach((res) => res.write('data: reload\n\n'));
}

const WATCH_EXT = new Set(['.html', '.js', '.css', '.md', '.json']);
let debounceTimer = null;
try {
  fs.watch(root, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.startsWith('.git') || filename.startsWith('.wrangler') || filename.startsWith('node_modules')) return;
    if (!WATCH_EXT.has(path.extname(filename).toLowerCase())) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log('เปลี่ยนแปลง: ' + filename + ' -> reload ' + sseClients.length + ' แท็บ');
      broadcastReload();
    }, 100); // debounce กันเซฟรัวๆ แล้วยิง reload ซ้ำหลายรอบ
  });
} catch (e) {
  console.log('เตือน: live-reload ใช้ไม่ได้บนระบบนี้ (fs.watch recursive ไม่รองรับ) — ยังใช้เว็บได้ปกติ แค่ต้องกด F5 เอง');
}

const LIVERELOAD_SCRIPT =
  '<script>(function(){' +
  'var es=new EventSource("/__livereload");' +
  'es.onmessage=function(){location.reload();};' +
  'es.onerror=function(){};' + // เชื่อมต่อใหม่อัตโนมัติโดย browser เองอยู่แล้วถ้าหลุด
  '})();</script>';

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\n');
    sseClients.push(res);
    req.on('close', () => {
      const i = sseClients.indexOf(res);
      if (i > -1) sseClients.splice(i, 1);
    });
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') {
      const html = data.toString('utf8').replace('</body>', LIVERELOAD_SCRIPT + '</body>');
      res.writeHead(200, { 'Content-Type': MIME[ext] });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => {
  console.log('Serving ' + root + ' at http://localhost:' + port + ' (live-reload เปิดอยู่ — แก้ไฟล์แล้วเซฟ เบราว์เซอร์ reload ให้เอง)');
});
