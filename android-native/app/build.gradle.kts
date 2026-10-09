plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

android {
    namespace = "com.gymbrodaily.nativeapp"
    compileSdk = 37

    defaultConfig {
        // ต่อท้าย .beta เพื่อติดตั้งคู่กับแอป Capacitor เดิม (com.gymbrodaily.app) ได้ ไม่ทับข้อมูลกัน
        applicationId = "com.gymbrodaily.app.beta"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
    }
}

/* ภาพรูปร่าง/ภาพหมุน 360° ใช้ไฟล์ชุดเดียวกับเว็บที่ <repo>/bodyfat — คัดลอกเข้า assets ตอน build
   แทนการเก็บซ้ำใน android-native (แก้ภาพที่เดียว เว็บกับแอปได้ภาพเดียวกัน) */
abstract class CopyBodyfatAssets : DefaultTask() {
    @get:InputDirectory @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val source: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copy() {
        fs.sync {
            from(source)
            into(outputDir.dir("bodyfat"))
        }
    }
}

val copyBodyfatAssets = tasks.register<CopyBodyfatAssets>("copyBodyfatAssets") {
    source.set(rootProject.layout.projectDirectory.dir("../bodyfat"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyBodyfatAssets, CopyBodyfatAssets::outputDir)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    // API ของ M3 Expressive (MaterialExpressiveTheme, LoadingIndicator ฯลฯ) ใช้ได้เฉพาะรุ่น alpha — ทับเวอร์ชันจาก BOM
    implementation("androidx.compose.material3:material3:1.5.0-alpha29")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")

    val supabase = platform("io.github.jan-tennert.supabase:bom:3.8.0")
    implementation(supabase)
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.ktor:ktor-client-okhttp:3.6.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

    testImplementation("junit:junit:4.13.2")
}
