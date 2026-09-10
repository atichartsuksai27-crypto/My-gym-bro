"""เรนเดอร์ภาพหมุนรอบตัว 360 องศา ของภาพอ้างอิงระดับไขมัน (6 ระดับ x 2 เพศ)

ใช้โมเดล/ค่า macro/แสง/กล้อง "ชุดเดียวกับภาพนิ่ง" ทั้งหมดโดย import จาก render_all.py
โดยตรง (LEVELS, build_human, frame_and_light) — ห้ามคัดลอกค่ามาไว้ที่นี่เด็ดขาด ไม่งั้น
วันหนึ่งภาพหมุนกับภาพนิ่งจะกลายเป็นคนละร่างโดยไม่มีใครรู้ตัว

ผลลัพธ์: bodyfat/spin/bf-{sex}-{band}-{NN}.webp  (NN = 00..FRAMES-1 เรียงตามมุม)
  เฟรม 00 = ด้านหน้าตรง (มุมเดียวกับภาพนิ่ง bf-{sex}-{band}.png เป๊ะ)
  หมุนทวนไปเรื่อยๆ ทีละ 360/FRAMES องศา จนครบรอบ

ทำไมเป็น WEBP ไม่ใช่ PNG: ภาพหมุนมี 12 โมเดล x FRAMES เฟรม ถ้าเป็น PNG (lossless
~120KB/เฟรม) รวมกันจะเกิน 30MB ซึ่งหนักเกินไปทั้งกับ repo และขนาด APK — WEBP แบบ lossy
ที่ quality 80 ยังรองรับ alpha (พื้นหลังโปร่งใส) ครบและเล็กกว่าราว 5-6 เท่า โดยที่ภาพ
clay สีเทาเรียบๆ แบบนี้แทบมองไม่ออกว่าต่างจาก lossless

รัน: blender --background --python render_spin.py
  ตัวแปรสภาพแวดล้อมสำหรับทดสอบ (ไม่ใส่ = ทำครบทุกภาพ):
    BF_SPIN_ONLY="male:30-35"  เรนเดอร์เฉพาะร่างเดียว
    BF_SPIN_FRAMES="8"         ลดจำนวนเฟรมตอนทดสอบให้เร็วขึ้น
"""
import bpy, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_all import LEVELS, build_human, frame_and_light, render_to, OUT_DIR

FRAMES = int(os.environ.get("BF_SPIN_FRAMES", "24"))
ONLY = os.environ.get("BF_SPIN_ONLY", "").strip()
QUALITY = int(os.environ.get("BF_SPIN_QUALITY", "80"))

SPIN_DIR = os.path.join(OUT_DIR, "spin")
os.makedirs(SPIN_DIR, exist_ok=True)

count = 0
for sex in ("male", "female"):
    gender_val = 1.0 if sex == "male" else 0.0
    for band_key, pct_label, weight_val, muscle_val in LEVELS:
        if ONLY and ONLY != "{}:{}".format(sex, band_key):
            continue
        # สร้างร่างครั้งเดียวต่อ 1 ระดับ แล้ววนเรนเดอร์ทุกมุม — ไม่ต้อง build ใหม่ทุกเฟรม
        # (build_human รีเซ็ตฉากทั้งหมด ถ้าเรียกทุกเฟรมจะช้ากว่าเดิมหลายเท่าโดยไม่จำเป็น)
        basemesh = build_human(gender_val, weight_val, muscle_val)
        for i in range(FRAMES):
            angle = 360.0 * i / FRAMES
            out_path = os.path.join(SPIN_DIR, "bf-{}-{}-{:02d}.webp".format(sex, band_key, i))
            print("[spin] {} {} ({}) angle={:.1f} -> {}".format(sex, band_key, pct_label, angle, out_path))
            frame_and_light(basemesh, angle)
            render_to(out_path, file_format='WEBP', quality=QUALITY)
            count += 1

print("DONE: {} spin frames -> {}".format(count, SPIN_DIR))
