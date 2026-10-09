// node gen-kotlin.js → เขียน BodyMapData.kt จาก figures.js (อย่าแก้ไฟล์ .kt ด้วยมือ)
const fs = require("fs");
const path = require("path");
const figs = require("./figures");
const out = path.join(__dirname, "../../app/src/main/java/com/gymbrodaily/nativeapp/ui/BodyMapData.kt");
const list = (parts) => parts.map(({ g, d, m }) => `        BodyPart("${g}", "${d}", ${m}),`).join("\n");
const kt = `package com.gymbrodaily.nativeapp.ui

/* สร้างอัตโนมัติจาก tools/bodymap/figures.js ด้วย gen-kotlin.js — แก้ที่ figures.js แล้วรันใหม่ */

/** g: "base"/"hair"/"fore"/"line" = ส่วนตกแต่ง, อย่างอื่น = กลุ่มท่า (แตะได้) · m = สะท้อนซ้าย-ขวา */
internal class BodyPart(val g: String, val d: String, val m: Boolean)

internal object BodyMapData {
${["maleFront", "maleBack", "femaleFront", "femaleBack"].map((k) =>
  `    val ${k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase()} = listOf(\n${list(figs[k])}\n    )`).join("\n\n")}
}
`;
fs.writeFileSync(out, kt);
console.log("wrote", out);
