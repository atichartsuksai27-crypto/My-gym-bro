package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.Serializable

/** Values and identifiers match app.js FOODS; nutrients per 100 g. */
data class Food(val id: String, val cat: String, val name: String, val p: Double, val c: Double, val f: Double, val unit: String? = null)

@Serializable
data class FoodEntry(val fid: String, val cat: String, val name: String, val g: Double, val p: Double, val c: Double, val f: Double, val kcal: Double)

object Foods {
    val catalog = listOf(
        Food("chk_breast", "protein", "อกไก่ไม่มีหนัง (สุก)", 31.0, 0.0, 3.6, null),
        Food("chk_thigh", "protein", "สะโพกไก่ไม่มีหนัง (สุก)", 26.0, 0.0, 10.9, null),
        Food("chk_drum", "protein", "น่องไก่ไม่มีหนัง (สุก)", 28.3, 0.0, 5.7, null),
        Food("chk_wing", "protein", "ปีกไก่ติดหนัง (สุก)", 26.9, 0.0, 19.5, null),
        Food("egg", "protein", "ไข่ไก่ทั้งฟอง (ต้ม)", 12.6, 1.1, 10.6, "1 ฟอง ≈ 50 g"),
        Food("egg_white", "protein", "ไข่ขาว (สุก)", 10.9, 0.7, 0.2, "ไข่ขาว 1 ฟอง ≈ 33 g"),
        Food("pork_loin", "protein", "หมูสันใน (สุก)", 26.2, 0.0, 3.5, null),
        Food("pork_mince", "protein", "หมูสับ (สุก)", 25.7, 0.0, 20.8, null),
        Food("beef_lean", "protein", "เนื้อวัวไม่ติดมัน (สุก)", 29.0, 0.0, 7.0, null),
        Food("salmon", "protein", "ปลาแซลมอน (สุก)", 22.1, 0.0, 12.4, null),
        Food("tilapia", "protein", "ปลานิล (สุก)", 26.2, 0.0, 2.7, null),
        Food("shrimp", "protein", "กุ้ง (สุก)", 24.0, 0.2, 0.3, null),
        Food("tuna", "protein", "ทูน่ากระป๋องในน้ำแร่ (สะเด็ดน้ำ)", 25.5, 0.0, 0.8, null),
        Food("tofu", "protein", "เต้าหู้แข็ง", 17.3, 2.8, 8.7, null),
        Food("whey", "protein", "เวย์โปรตีน (ผง)", 80.0, 8.0, 6.0, "1 สกูป ≈ 30 g"),
        Food("milk", "protein", "นมจืด", 3.2, 4.8, 3.3, "1 กล่อง ≈ 200-250 ml (≈ กรัม)"),
        Food("rice", "carb", "ข้าวขาว (หุงสุก)", 2.7, 28.2, 0.3, "1 ทัพพี ≈ 60 g"),
        Food("rice_brown", "carb", "ข้าวกล้อง (หุงสุก)", 2.7, 25.6, 1.0, "1 ทัพพี ≈ 60 g"),
        Food("sticky_rice", "carb", "ข้าวเหนียวนึ่ง", 2.0, 21.1, 0.2, null),
        Food("rice_noodle", "carb", "เส้นก๋วยเตี๋ยว (ลวก)", 1.8, 24.0, 0.2, null),
        Food("egg_noodle", "carb", "บะหมี่ไข่ (ลวก)", 4.5, 25.2, 2.1, null),
        Food("bread", "carb", "ขนมปังขาว", 9.0, 49.0, 3.2, "1 แผ่น ≈ 30 g"),
        Food("bread_ww", "carb", "ขนมปังโฮลวีท", 12.4, 43.0, 3.5, "1 แผ่น ≈ 30 g"),
        Food("oats", "carb", "ข้าวโอ๊ต (แห้ง ก่อนต้ม)", 16.9, 66.0, 6.9, null),
        Food("pasta", "carb", "พาสต้า (ต้มสุก)", 5.8, 31.0, 0.9, null),
        Food("potato", "carb", "มันฝรั่ง (ต้ม)", 1.9, 20.1, 0.1, null),
        Food("sweet_potato", "carb", "มันเทศ (สุก)", 2.0, 20.7, 0.2, null),
        Food("banana", "carb", "กล้วยหอม", 1.1, 22.8, 0.3, "1 ลูก ≈ 120 g (ไม่รวมเปลือก)"),
        Food("oil", "fat", "น้ำมันพืช/น้ำมันมะกอก", 0.0, 0.0, 100.0, "1 ช้อนโต๊ะ ≈ 14 g"),
        Food("butter", "fat", "เนย", 0.9, 0.1, 81.0, "1 ช้อนโต๊ะ ≈ 14 g"),
        Food("avocado", "fat", "อะโวคาโด", 2.0, 8.5, 14.7, null),
        Food("almond", "fat", "อัลมอนด์", 21.2, 21.6, 49.9, null),
        Food("peanut", "fat", "ถั่วลิสงคั่ว", 23.7, 21.5, 49.7, null),
        Food("peanut_butter", "fat", "เนยถั่ว", 25.0, 20.0, 50.0, "1 ช้อนโต๊ะ ≈ 16 g"),
        Food("coconut_milk", "fat", "กะทิ", 2.3, 5.5, 23.8, null),
    )
    private fun r1(v: Double) = jsRound(v * 10) / 10
    fun entry(food: Food, grams: Double): FoodEntry {
        require(grams.isFinite() && grams in 1.0..3000.0)
        val p = r1(food.p * grams / 100)
        val c = r1(food.c * grams / 100)
        val f = r1(food.f * grams / 100)
        return FoodEntry(food.id, food.cat, food.name, grams, p, c, f, jsRound(p * 4 + c * 4 + f * 9))
    }
    fun add(n: Nutrition, food: Food, grams: Double): Nutrition {
        val m = entry(food, grams)
        return n.copy(foods = n.foods + m, proteinG = r1((n.proteinG ?: 0.0) + m.p), carbG = r1((n.carbG ?: 0.0) + m.c), fatG = r1((n.fatG ?: 0.0) + m.f), kcal = jsRound((n.kcal ?: 0.0) + m.kcal))
    }
    fun remove(n: Nutrition, index: Int): Nutrition {
        val m = n.foods.getOrNull(index) ?: return n
        return n.copy(foods = n.foods.filterIndexed { i, _ -> i != index }, proteinG = r1(((n.proteinG ?: 0.0) - m.p).coerceAtLeast(0.0)), carbG = r1(((n.carbG ?: 0.0) - m.c).coerceAtLeast(0.0)), fatG = r1(((n.fatG ?: 0.0) - m.f).coerceAtLeast(0.0)), kcal = jsRound((n.kcal ?: 0.0) - m.kcal).coerceAtLeast(0.0))
    }
}
