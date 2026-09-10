"""สร้างภาพอ้างอิงระดับไขมันร่างกาย (body fat) 4 ระดับ x 2 เพศ = 8 ภาพ
ใช้ MPFB (MakeHuman for Blender) วาดร่างคนแบบพารามิเตอร์ ไม่ใช้ไฟล์ภาพจากที่อื่น

หมวดหมู่ % อ้างอิงจาก ACE (American Council on Exercise) body fat categories
ซึ่งเป็นเกณฑ์ที่เผยแพร่สาธารณะและถูกอ้างอิงกว้างขวาง — ไม่ใช่ตัวเลขที่เดาขึ้นเอง
(อ้างอิง: ACE Fit body composition chart) ตั้งใจข้าม "Essential fat" (ต่ำสุด) ออก
เพราะเป็นระดับที่เสี่ยงต่อสุขภาพถ้าไม่ได้อยู่ภายใต้การดูแลนักกีฬา/แพทย์ ไม่เหมาะเป็น
"ตัวเลือกปกติ" ให้คนทั่วไปเทียบเคียง

weight_macro / muscle_macro คือค่าที่ MPFB ใช้ขยับรูปร่างให้ "ดูสอดคล้อง" กับแต่ละช่วง
— เป็นการ map โดยประมาณ (MakeHuman ไม่มีสูตรแปลง weight-slider เป็น body-fat % ที่แม่นยำ)
ไม่ใช่การวัดทางวิทยาศาสตร์ — หน้า UI ต้องกำกับว่าเป็น "ภาพประกอบคร่าวๆ" เสมอ (ดู Q14
ใน app.js ที่ดึงภาพชุดนี้ไปใช้)

หมายเหตุสำคัญที่ทดสอบแล้วพบ: ปรับ weight อย่างเดียวความต่างระหว่างระดับจะจางมาก (target
ของ MPFB ตัว "weight" เพิ่มมวลรวมแบบกว้างๆ ไม่ได้เน้นพุง/ไขมันสะสมชัดเจน) ต้องปรับ muscle
สวนทางกันด้วยถึงจะเห็นความต่างชัด — ไขมันยิ่งน้อย กล้ามเนื้อยิ่งเห็นชัด (เพราะไขมันบังกล้ามเนื้อ
น้อยลงตามสรีระจริง) ไขมันยิ่งมาก กล้ามเนื้อยิ่งถูกบังจนไม่เห็นเส้น — จึงให้ทั้งสองค่าแปรผกผันกัน

รัน: blender --background --python render_all.py
"""
import bpy, math, os
from mathutils import Vector, Matrix

from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

# ต้องอยู่ที่ root โปรเจกต์ (ไม่ใช่ mobile/assets) เพราะ Q14 อยู่ใน app.js ที่ใช้ร่วมกัน
# ทั้งเว็บที่ deploy จริงและแอป native — mobile/scripts/sync-web.js คัดลอกโฟลเดอร์นี้
# เข้า mobile/www/ ให้เองตอน build แอป (ดู FOLDERS ในไฟล์นั้น)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "bodyfat")
os.makedirs(OUT_DIR, exist_ok=True)

# (key, ป้าย %, weight, muscle)
BANDS = {
  "male": [
    ("athletes", "6-13%",  0.12, 0.80),
    ("fitness",  "14-17%", 0.32, 0.62),
    ("average",  "18-24%", 0.55, 0.40),
    ("high",     "25%+",   0.88, 0.12),
  ],
  "female": [
    ("athletes", "14-20%", 0.16, 0.75),
    ("fitness",  "21-24%", 0.36, 0.58),
    ("average",  "25-31%", 0.58, 0.38),
    ("high",     "32%+",   0.88, 0.12),
  ],
}


def swing_arm_down(armature, bone_name, lean_deg=24):
    """หมุนกระดูกต้นแขน (world space) จาก T-pose เริ่มต้นให้ลงมาแนบลำตัวแบบผ่อนคลาย
    คำนวณจากทิศทางปัจจุบันจริงของกระดูก ไม่ hardcode มุม เพื่อให้ใช้ได้กับแขนซ้าย/ขวา
    โดยไม่ต้องสนใจ roll ของกระดูก (ดูรายละเอียดที่ render_one_test.py)"""
    pb = armature.pose.bones[bone_name]
    head_w = armature.matrix_world @ pb.head
    tail_w = armature.matrix_world @ pb.tail
    cur_dir = (tail_w - head_w).normalized()
    side = 1 if cur_dir.x > 0 else -1
    lean = math.radians(lean_deg)
    target_dir = Vector((side * math.sin(lean), 0, -math.cos(lean))).normalized()
    rot = cur_dir.rotation_difference(target_dir)
    mat_world = armature.matrix_world.inverted() @ (
        Matrix.Translation(head_w) @ rot.to_matrix().to_4x4()
        @ Matrix.Translation(-head_w) @ (armature.matrix_world @ pb.matrix)
    )
    pb.matrix = mat_world


def render_one(gender_val, weight_val, muscle_val, out_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    macro = TargetService.get_default_macro_info_dict()
    macro["gender"] = gender_val
    macro["weight"] = weight_val
    macro["muscle"] = muscle_val
    basemesh = HumanService.create_human(macro_detail_dict=macro, scale=1.0)

    armature = HumanService.add_builtin_rig(basemesh, "default")
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    swing_arm_down(armature, "upperarm01.L")
    swing_arm_down(armature, "upperarm01.R")
    bpy.ops.object.mode_set(mode='OBJECT')

    mod = basemesh.modifiers.new("Armature", 'ARMATURE')
    mod.object = armature
    armature.hide_render = True

    mat = bpy.data.materials.new("ClayGrey")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55
    basemesh.data.materials.clear()
    basemesh.data.materials.append(mat)

    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = basemesh.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()
    bb = [eval_obj.matrix_world @ v.co for v in eval_mesh.vertices]
    eval_obj.to_mesh_clear()
    xs = [c.x for c in bb]; ys = [c.y for c in bb]; zs = [c.z for c in bb]
    cx, cy, cz = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2
    height = max(zs) - min(zs)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 19.5  # ค่าคงที่ทุกภาพ (ไม่ auto-fit ต่อภาพ) เพื่อให้เทียบขนาด/
    # สัดส่วนกันได้จริงระหว่างระดับไขมัน — auto-fit แต่ละภาพเองจะซูมกลบความต่างของขนาดตัว
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    dist = height * 3
    cam.location = (cx, cy - dist, cz)
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

    sun_data = bpy.data.lights.new("Key", type='SUN')
    sun_data.energy = 2.6
    sun_data.angle = math.radians(20)
    sun = bpy.data.objects.new("Key", sun_data)
    sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
    bpy.context.scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new("Fill", type='SUN')
    fill_data.energy = 1.4
    fill_data.angle = math.radians(30)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.rotation_euler = (math.radians(70), 0, math.radians(150))
    bpy.context.scene.collection.objects.link(fill)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 420
    scene.render.resolution_y = 720
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 90  # PNG เป็น lossless อยู่แล้ว ค่านี้แค่ลดขนาดไฟล์ ไม่ลดคุณภาพ
    scene.render.filepath = out_path

    bpy.ops.render.render(write_still=True)


count = 0
for sex, bands in BANDS.items():
    gender_val = 1.0 if sex == "male" else 0.0
    for band_key, pct_label, weight_val, muscle_val in bands:
        out_path = os.path.join(OUT_DIR, "bf-{}-{}.png".format(sex, band_key))
        print("[render] {} {} ({}) -> {}".format(sex, band_key, pct_label, out_path))
        render_one(gender_val, weight_val, muscle_val, out_path)
        count += 1

print("DONE: {} images -> {}".format(count, OUT_DIR))
