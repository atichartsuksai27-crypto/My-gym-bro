// node preview.js → preview.html (เปิดด้วย Chrome headless เพื่อดูภาพก่อนพอร์ตเข้า Kotlin)
const fs = require("fs");
const figs = require("./figures");
const COLOR = {
  squat: "#A9C0FF", hinge: "#FFD04D", hpush: "#FFB1CE", hpull: "#7FE0C5", vpull: "#C9B2FF", vpush: "#FFB27A",
  core: "#8BE39B", biceps: "#8FD3FF", triceps: "#FF9EA8", delts: "#C7E86B", calves: "#FFC2A0",
};
// เส้นตกแต่งที่สะท้อนก็ใช้ transform เดียวกัน
const mirror = 'transform="matrix(-1 0 0 1 100 0)"';
function svg(parts) {
  const out = parts.map(({ g, d, m }) => {
    const fill = g === "base" ? "#3A3E48" : g === "hair" ? "#23252C" : g === "fore" ? "#4A4F5B" : g === "line" ? "none" : COLOR[g];
    const stroke = g === "line" ? 'stroke="#101114" stroke-opacity=".55" stroke-width=".7"' : g === "base" || g === "hair" ? "" : g === "fore" ? 'stroke="#101114" stroke-width=".9"' : 'stroke="#101114" stroke-width=".9"';
    const el = `<path d="${d}" fill="${fill}" ${stroke} stroke-linejoin="round"/>`;
    return m ? el + `<g ${mirror}>${el}</g>` : el;
  });
  return `<svg viewBox="0 0 100 200" width="250" height="500">${out.join("")}</svg>`;
}
const html = `<html><body style="background:#1B1D23;margin:0;display:flex;gap:10px;padding:10px">
${["maleFront", "maleBack", "femaleFront", "femaleBack"].map((k) => svg(figs[k])).join("")}
</body></html>`;
fs.writeFileSync(__dirname + "/preview.html", html);
