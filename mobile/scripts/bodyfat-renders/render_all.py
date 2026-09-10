"""[PLACEHOLDER ชั่วคราว] สร้างภาพอ้างอิงระดับไขมันร่างกาย (body fat) 6 ระดับ x 2 เพศ = 12 ภาพ
ใช้ MPFB (MakeHuman for Blender) วาดร่างคนแบบพารามิเตอร์ ไม่ใช้ไฟล์ภาพจากที่อื่น

เดิมทำ 4 ระดับตามเกณฑ์ ACE (แยก % หญิง/ชาย) ภายหลังเปลี่ยนมาใช้ 6 ระดับแบบ % ตรงไปตรงมา
(5-9% ถึง 30-35%, ช่วงเดียวกันทั้งสองเพศ) ตามที่ผู้ใช้ขอให้เทียบเคียงกับภาพอ้างอิงสไตล์อื่น —
ชุดนี้เป็น placeholder ระหว่างรอภาพจริงจาก AI image generator (คุณภาพ clay-render ธรรมดา
ไม่สมจริงเท่าภาพถ่าย/AI-generated เห็นชัดถ้าเทียบกัน) รันสคริปต์นี้ใหม่ได้เสมอถ้าต้องการ
กลับมาใช้ชุดนี้ หรือปรับสัดส่วนต่อ

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

# (key, ป้าย %, weight, muscle) — ช่วงเดียวกันทั้งสองเพศ ตามที่ตกลงกันไว้
LEVELS = [
  ("05-09", "5-9%",   0.10, 0.85),
  ("10-14", "10-14%", 0.26, 0.70),
  ("15-19", "15-19%", 0.42, 0.55),
  ("20-24", "20-24%", 0.58, 0.40),
  ("25-29", "25-29%", 0.74, 0.25),
  ("30-35", "30-35%", 0.90, 0.10),
]
BANDS = {"male": LEVELS, "female": LEVELS}


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


def build_human(gender_val, weight_val, muscle_val):
    """สร้างฉากใหม่ + ร่างคนตามค่า macro + จัดท่าแขน + ใส่วัสดุ clay — คืน basemesh
    แยกออกมาเป็นฟังก์ชันเพื่อให้ render_spin.py (ภาพหมุน 360°) ใช้ตัวเดียวกันได้
    ห้ามให้สองสคริปต์สร้างโมเดลคนละวิธี ไม่งั้นภาพหมุนกับภาพนิ่งจะเป็นคนละร่าง"""
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
    return basemesh


def frame_and_light(basemesh, angle_deg=0.0):
    """วางกล้อง ortho + ไฟ โดยหมุนรอบแกน Z ไปที่มุม angle_deg (0 = ด้านหน้าตรง)

    หมุน "กล้องพร้อมไฟ" ไปด้วยกันเป็นชุดแข็ง ไม่ใช่หมุนตัวโมเดล — ทั้งชุดกล้อง+ไฟจึงมี
    ตำแหน่งสัมพัทธ์กันคงที่ทุกเฟรม ผิวที่หันเข้าหากล้องจึงได้มุมแสงตกกระทบเท่ากันเสมอ
    = สีเทาสม่ำเสมอทุกองศา (ถ้าตรึงไฟไว้กับโลกแล้วให้กล้องโคจรรอบแทน แต่ละด้านของ
    ร่างกายจะสว่างไม่เท่ากันทันที เพราะไฟส่องด้านหนึ่งตรงกว่าอีกด้าน)

    สำคัญ: ต้องลบกล้อง/ไฟของเฟรมก่อนหน้าทิ้งก่อนทุกครั้ง (โค้ดบรรทัดแรกด้านล่าง)
    ฟังก์ชันนี้ "สร้าง" กล้องกับไฟดวงใหม่ทุกครั้งที่ถูกเรียก ตอนเรนเดอร์ภาพนิ่งไม่มีปัญหา
    เพราะ build_human() รีเซ็ตฉากใหม่ทั้งหมดก่อนเรียกทุกครั้ง (เฟรมละ 1 ชุด) แต่ตอน
    เรนเดอร์ภาพหมุน (render_spin.py) จะสร้างร่างครั้งเดียวแล้ววนเรียกฟังก์ชันนี้ 24 รอบ
    ถ้าไม่ลบของเก่าทิ้ง ไฟจะสะสมทับกันเพิ่มขึ้นเรื่อยๆ (เฟรมที่ 24 = ไฟ 48 ดวง) ภาพจึง
    ค่อยๆ สว่างขึ้นทีละเฟรมจนขาวโพลน — นี่คือต้นเหตุจริงของบั๊ก "หมุนแล้วโมเดลเป็นสีขาว
    เรืองแสง" ไม่เกี่ยวกับค่าแสงหรือวัสดุแต่อย่างใด"""
    for obj in [o for o in bpy.context.scene.objects if o.type in {'CAMERA', 'LIGHT'}]:
        bpy.data.objects.remove(obj, do_unlink=True)

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
    a = math.radians(angle_deg)
    cam.location = (cx + dist * math.sin(a), cy - dist * math.cos(a), cz)
    cam.rotation_euler = (math.radians(90), 0, a)
    bpy.context.scene.camera = cam

    sun_data = bpy.data.lights.new("Key", type='SUN')
    sun_data.energy = 2.6
    sun_data.angle = math.radians(20)
    sun = bpy.data.objects.new("Key", sun_data)
    sun.rotation_euler = (math.radians(55), 0, math.radians(-35) + a)
    bpy.context.scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new("Fill", type='SUN')
    fill_data.energy = 1.4
    fill_data.angle = math.radians(30)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.rotation_euler = (math.radians(70), 0, math.radians(150) + a)
    bpy.context.scene.collection.objects.link(fill)


def render_to(out_path, file_format='PNG', quality=90):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 420
    scene.render.resolution_y = 720
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = file_format
    scene.render.image_settings.color_mode = 'RGBA'
    if file_format == 'PNG':
        scene.render.image_settings.compression = quality  # PNG lossless อยู่แล้ว ค่านี้แค่ลดขนาดไฟล์ ไม่ลดคุณภาพ
    else:
        scene.render.image_settings.quality = quality      # WEBP: lossy จริง (ใช้กับภาพหมุนที่มีหลายเฟรม)
    scene.render.filepath = out_path

    bpy.ops.render.render(write_still=True)


def render_one(gender_val, weight_val, muscle_val, out_path):
    basemesh = build_human(gender_val, weight_val, muscle_val)
    frame_and_light(basemesh, 0.0)
    render_to(out_path)


# ครอบด้วย __main__ guard เพราะ render_spin.py import ไฟล์นี้เพื่อใช้ LEVELS/build_human/
# frame_and_light ร่วมกัน — ถ้าไม่ครอบ การ import จะสั่งเรนเดอร์ภาพนิ่งใหม่ทั้ง 12 ภาพทันที
if __name__ == "__main__":
    count = 0
    for sex, bands in BANDS.items():
        gender_val = 1.0 if sex == "male" else 0.0
        for band_key, pct_label, weight_val, muscle_val in bands:
            out_path = os.path.join(OUT_DIR, "bf-{}-{}.png".format(sex, band_key))
            print("[render] {} {} ({}) -> {}".format(sex, band_key, pct_label, out_path))
            render_one(gender_val, weight_val, muscle_val, out_path)
            count += 1

    print("DONE: {} images -> {}".format(count, OUT_DIR))
