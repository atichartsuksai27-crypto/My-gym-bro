package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class FoodsTest {
    @Test fun catalogAndMacrosMatchWeb() {
        val fixtures = loadGolden("foods.json")
        assertEquals(fixtures.size, Foods.catalog.size)
        fixtures.forEach { fixture ->
            val obj = fixture.jsonObject
            val f = obj.getValue("food").jsonObject
            val food = Foods.catalog.first { it.id == f.getValue("id").jsonPrimitive.content }
            assertEquals(f.getValue("name").jsonPrimitive.content, food.name)
            assertEquals(f.getValue("cat").jsonPrimitive.content, food.cat)
            assertEquals(f["unit"]?.jsonPrimitive?.content, food.unit)
            obj.getValue("cases").jsonArray.forEach { case ->
                val c = case.jsonObject
                val m = Foods.entry(food, c.getValue("g").jsonPrimitive.double)
                listOf("p" to m.p, "c" to m.c, "f" to m.f, "kcal" to m.kcal).forEach { (key, value) ->
                    assertEquals("${food.id} $case $key", c.getValue(key).jsonPrimitive.double, value, 1e-9)
                }
            }
        }
    }

    @Test fun addRemovePreservesManualTotalsAndOtherFields() {
        val before = Nutrition(proteinG = 20.0, carbG = 40.0, fatG = 10.0, kcal = 330.0, waterL = 2.0, meals = listOf(true))
        val added = Foods.add(before, Foods.catalog.first(), 100.0)
        assertEquals(51.0, added.proteinG!!, 0.0)
        assertEquals(486.0, added.kcal!!, 0.0)
        assertEquals(before, Foods.remove(added, 0))
        assertEquals(added, Foods.remove(added, 100))
    }

    @Test fun mixedCategoriesAndDuplicateFoodsRemoveOnlySelectedEntry() {
        val chicken = Foods.catalog.first()
        val rice = Foods.catalog.first { it.id == "rice" }
        val n = Foods.add(Foods.add(Foods.add(Nutrition(), chicken, 100.0), rice, 200.0), chicken, 50.0)
        val out = Foods.remove(n, 0)
        assertEquals(listOf("rice", chicken.id), out.foods.map { it.fid })
        assertEquals(20.9, out.proteinG!!, 1e-9)
        val roundTrip = Json.decodeFromString<Nutrition>(Json.encodeToString(out))
        assertEquals(out, roundTrip)
        assertEquals(emptyList<FoodEntry>(), Json.decodeFromString<Nutrition>("{\"proteinG\":80}").foods)
    }

    @Test fun invalidGramsRejectedAndTotalsNeverNegative() {
        listOf(0.0, -1.0, 3001.0, Double.NaN, Double.POSITIVE_INFINITY).forEach { g ->
            assertThrows(IllegalArgumentException::class.java) { Foods.add(Nutrition(), Foods.catalog.first(), g) }
        }
        val added = Foods.add(Nutrition(), Foods.catalog.first(), 100.0)
        val out = Foods.remove(added.copy(proteinG = 1.0, kcal = 1.0), 0)
        assertEquals(0.0, out.proteinG!!, 0.0)
        assertEquals(0.0, out.kcal!!, 0.0)
    }
}
