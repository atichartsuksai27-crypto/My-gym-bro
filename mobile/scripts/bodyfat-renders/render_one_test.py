"""ทดสอบ pipeline เดียวก่อนทำเป็นชุด — สร้างคน 1 ตัว (ชาย, weight=เฉลี่ย) ใส่ rig แล้วหมุน
แขนลงข้างลำตัว (ของเดิม T-pose ไม่เหมาะกับภาพเทียบรูปร่าง) แล้ว render ออกมาดูคุณภาพ
รัน: blender --background --python render_one_test.py
"""
import bpy, math, os
from mathutils import Vector

from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

OUT = os.path.join(os.path.dirname(__file__), "_test_render.png")

bpy.ops.wm.read_factory_settings(use_empty=True)

macro = TargetService.get_default_macro_info_dict()
macro["gender"] = 1.0
macro["weight"] = 0.5
macro["muscle"] = 0.5
basemesh = HumanService.create_human(macro_detail_dict=macro, scale=1.0)

# ---------- ใส่ rig แล้วหมุนแขนลงข้างลำตัว (แทน T-pose เดิม) ----------
armature = HumanService.add_builtin_rig(basemesh, "default")
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='POSE')

def swing_arm_down(bone_name, lean_deg=15):
    """หมุนกระดูกต้นแขน (world space) ให้ปลายแขนชี้ลงข้างลำตัวแทนชี้ออกด้านข้าง (T-pose)
    คำนวณจากทิศทางปัจจุบันจริงของกระดูก ไม่ hardcode มุม เพื่อไม่ต้องสนใจว่าเป็นแขนซ้ายขวา
    หรือ roll ของกระดูกเป็นเท่าไหร่ — ใช้ rotation_difference หาการหมุนที่พาไปยังทิศทางที่ต้องการ"""
    pb = armature.pose.bones[bone_name]
    head_w = armature.matrix_world @ pb.head
    tail_w = armature.matrix_world @ pb.tail
    cur_dir = (tail_w - head_w).normalized()
    side = 1 if cur_dir.x > 0 else -1  # แขนขวา (+X) หรือซ้าย (-X) ของโมเดล
    lean = math.radians(lean_deg)
    target_dir = Vector((side * math.sin(lean), 0, -math.cos(lean))).normalized()
    rot = cur_dir.rotation_difference(target_dir)
    mat_world = armature.matrix_world.inverted() @ (
        __import__('mathutils').Matrix.Translation(head_w) @ rot.to_matrix().to_4x4()
        @ __import__('mathutils').Matrix.Translation(-head_w) @ (armature.matrix_world @ pb.matrix)
    )
    pb.matrix = mat_world

swing_arm_down("upperarm01.L", lean_deg=24)
swing_arm_down("upperarm01.R", lean_deg=24)

bpy.ops.object.mode_set(mode='OBJECT')

# ---------- ผูก armature modifier ให้ deform ตามท่าที่หมุนไว้ (ไม่ apply/bake จริง เพราะ
# mesh มี shape keys ของ MPFB อยู่ apply ตรงๆ ไม่ได้ — แค่ render เป็นภาพ ไม่ต้อง export
# geometry ต่อ จึงปล่อย modifier ทำงานสดตอน render พอ) ----------
mod = basemesh.modifiers.new("Armature", 'ARMATURE')
mod.object = armature
armature.hide_render = True

# ---------- วัสดุ clay สีเทาเรียบ ----------
mat = bpy.data.materials.new("ClayGrey")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)
bsdf.inputs["Roughness"].default_value = 0.55
basemesh.data.materials.clear()
basemesh.data.materials.append(mat)

# ---------- จัดกรอบกล้องอัตโนมัติจาก bounding box (ต้อง evaluate ผ่าน depsgraph เพราะ
# ท่าที่หมุนไว้มาจาก armature modifier สด — basemesh.data.vertices ยังเป็นท่า T-pose เดิม) ----------
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
eval_obj = basemesh.evaluated_get(depsgraph)
eval_mesh = eval_obj.to_mesh()
bb = [eval_obj.matrix_world @ v.co for v in eval_mesh.vertices]
eval_obj.to_mesh_clear()
xs = [c.x for c in bb]; ys = [c.y for c in bb]; zs = [c.z for c in bb]
cx, cy, cz = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2
width = max(xs) - min(xs)
height = max(zs) - min(zs)
print("BBOX height:", height, "width:", width)

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = height * 1.08
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
dist = height * 3
cam.location = (cx, cy - dist, cz)
cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new("Key", type='SUN')
sun_data.energy = 2.6
sun_data.angle = math.radians(20)  # แสงกว้างขึ้น = เงานุ่มขึ้น (ของเดิม default แคบมาก เงาคมเกินไป)
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
scene.render.resolution_x = 700
scene.render.resolution_y = 1200
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUT

bpy.ops.render.render(write_still=True)
print("DONE:", OUT)
