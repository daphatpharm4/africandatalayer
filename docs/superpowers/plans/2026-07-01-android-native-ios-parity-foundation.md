# Android Native iOS Parity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Slice 1 of the native Android app: Gradle/Kotlin/Compose foundation, ADL design tokens, all-role routing shell, language state, platform seams, and smoke tests.

**Architecture:** Create a native Compose app inside the existing `android/` directory without removing the existing Capacitor-generated assets. Keep Slice 1 deliberately thin: domain and platform seams are real and tested, while role screens are shell foundations that expose the correct routes and ADL visual language. Later role-surface plans will fill agent/admin/client/point-operator workflows without changing these foundations.

**Tech Stack:** Kotlin 2.4.0, Android Gradle Plugin 9.2.0, Gradle 9.4.1, Jetpack Compose BOM 2026.06.00, Material 3, AndroidX Activity Compose, JUnit, Compose UI test. Sources: approved design `docs/superpowers/specs/2026-07-01-android-native-ios-parity-design.md`; official AGP release notes identify AGP 9.2.0 and Gradle 9.4.1 compatibility; official Compose BOM docs show `androidx.compose:compose-bom:2026.06.00`; Kotlin docs list Kotlin 2.4.0 as the current stable release.

---

## File Structure

Create or modify these files only. Preserve unrelated dirty files and the existing generated Capacitor assets under `android/app/src/main/assets/`.

| File | Responsibility |
|------|----------------|
| `android/settings.gradle.kts` | Root Gradle project, plugin repositories, include `:app` only for Slice 1 |
| `android/build.gradle.kts` | Root plugin versions |
| `android/gradle.properties` | AndroidX, Kotlin, and build defaults |
| `android/app/build.gradle.kts` | Native Android app module build, dependencies, test config |
| `android/app/src/main/AndroidManifest.xml` | Native app manifest, permissions, `MainActivity` |
| `android/app/src/main/java/com/africandatalayer/app/MainActivity.kt` | Compose activity entry |
| `android/app/src/main/java/com/africandatalayer/app/AdlAndroidApp.kt` | Root app composition |
| `android/app/src/main/java/com/africandatalayer/app/model/AdlRoles.kt` | User roles, routes, tabs, bilingual helper |
| `android/app/src/main/java/com/africandatalayer/app/design/AdlTheme.kt` | ADL tokens, theme, reusable components |
| `android/app/src/main/java/com/africandatalayer/app/state/AppState.kt` | App state, language, selected role/tab |
| `android/app/src/main/java/com/africandatalayer/app/platform/PlatformAdapters.kt` | Camera/location/network/permission/haptic interfaces and no-op implementations |
| `android/app/src/main/java/com/africandatalayer/app/ui/AppShell.kt` | All-role bottom nav shell and role screen foundations |
| `android/app/src/test/java/com/africandatalayer/app/model/AdlRolesTest.kt` | Role routing unit tests |
| `android/app/src/test/java/com/africandatalayer/app/state/AppStateTest.kt` | State transition unit tests |
| `android/app/src/androidTest/java/com/africandatalayer/app/ui/AppShellTest.kt` | Compose shell smoke tests |

Do not include `:capacitor-cordova-android-plugins` in `settings.gradle.kts` during Slice 1. Its generated `build.gradle` currently carries its own legacy buildscript and should not block native foundation work.

## Task 1: Gradle Native Android Scaffold

**Files:**
- Create: `android/settings.gradle.kts`
- Create: `android/build.gradle.kts`
- Create: `android/gradle.properties`
- Create: `android/app/build.gradle.kts`
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: Gradle wrapper files via `gradle wrapper`

- [ ] **Step 1: Generate the Gradle wrapper**

Run:

```bash
cd android
gradle wrapper --gradle-version 9.4.1 --distribution-type bin
```

Expected: files appear at `android/gradlew`, `android/gradlew.bat`, `android/gradle/wrapper/gradle-wrapper.jar`, and `android/gradle/wrapper/gradle-wrapper.properties`.

- [ ] **Step 2: Create root Gradle settings**

Create `android/settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "AfricanDataLayerAndroid"
include(":app")
```

Create `android/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application") version "9.2.0" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0" apply false
}
```

Create `android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
```

- [ ] **Step 3: Create app build file**

Create `android/app/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.africandatalayer.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.africandatalayer.app"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        jvmToolchain(17)
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
```

Create `android/app/proguard-rules.pro`:

```pro
# Release shrink rules are empty for Slice 1.
```

- [ ] **Step 4: Create manifest**

Create `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@drawable/ic_launcher_foreground"
        android:label="African Data Layer"
        android:roundIcon="@drawable/ic_launcher_foreground"
        android:supportsRtl="true"
        android:theme="@style/Theme.ADL">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Create `android/app/src/main/res/values/styles.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.ADL" parent="android:style/Theme.Material.Light.NoActionBar">
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:statusBarColor">#0f2b46</item>
        <item name="android:navigationBarColor">#ffffff</item>
        <item name="android:fontFamily">sans</item>
    </style>
</resources>
```

Create `android/app/src/main/res/xml/backup_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="sharedpref" path="session.xml" />
</full-backup-content>
```

Create `android/app/src/main/res/xml/data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="session.xml" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="sharedpref" path="session.xml" />
    </device-transfer>
</data-extraction-rules>
```

Create `android/app/src/main/res/drawable/ic_launcher_foreground.xml` as the Slice 1 vector icon. Play Store asset polishing belongs to the release-readiness slice:

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#0f2b46"
        android:pathData="M0,0h108v108h-108z" />
    <path
        android:fillColor="#f4c317"
        android:pathData="M54,18l28,18v36l-28,18l-28,-18v-36z" />
    <path
        android:fillColor="#c86b4a"
        android:pathData="M54,32l16,10v20l-16,10l-16,-10v-20z" />
</vector>
```

- [ ] **Step 5: Run scaffold build to verify it fails for missing `MainActivity`**

Run:

```bash
cd android
./gradlew :app:assembleDebug
```

Expected: fails with unresolved `com.africandatalayer.app.MainActivity` because activity code is not created yet. If dependency resolution fails, rerun with network access and keep the same versions from this plan.

- [ ] **Step 6: Commit scaffold**

```bash
git add android/settings.gradle.kts android/build.gradle.kts android/gradle.properties android/gradlew android/gradlew.bat android/gradle/wrapper android/app/build.gradle.kts android/app/proguard-rules.pro android/app/src/main/AndroidManifest.xml android/app/src/main/res/values/styles.xml android/app/src/main/res/xml/backup_rules.xml android/app/src/main/res/xml/data_extraction_rules.xml android/app/src/main/res/drawable/ic_launcher_foreground.xml
git commit -m "chore(android): scaffold native Compose project"
```

## Task 2: Role And Route Domain Model

**Files:**
- Create: `android/app/src/main/java/com/africandatalayer/app/model/AdlRoles.kt`
- Create: `android/app/src/test/java/com/africandatalayer/app/model/AdlRolesTest.kt`

- [ ] **Step 1: Write failing route tests**

Create `android/app/src/test/java/com/africandatalayer/app/model/AdlRolesTest.kt`:

```kotlin
package com.africandatalayer.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdlRolesTest {
    @Test
    fun tabsMirrorIosNativeRouting() {
        assertEquals(
            listOf(AppRoute.Home, AppRoute.Contribute, AppRoute.Analytics, AppRoute.Profile),
            tabsFor(UserRole.Agent)
        )
        assertEquals(
            listOf(AppRoute.AdminReview, AppRoute.Home, AppRoute.Analytics, AppRoute.AgentPerformance, AppRoute.Profile),
            tabsFor(UserRole.Admin)
        )
        assertEquals(
            listOf(AppRoute.ClientDashboard, AppRoute.Investor, AppRoute.Home, AppRoute.Analytics, AppRoute.Profile),
            tabsFor(UserRole.Client)
        )
        assertEquals(
            listOf(AppRoute.PointOperatorStatus, AppRoute.PointOperatorProfile),
            tabsFor(UserRole.PointOperator)
        )
    }

    @Test
    fun defaultTabMatchesRoleEntryPoint() {
        assertEquals(AppRoute.Home, defaultTabFor(UserRole.Agent))
        assertEquals(AppRoute.AdminReview, defaultTabFor(UserRole.Admin))
        assertEquals(AppRoute.ClientDashboard, defaultTabFor(UserRole.Client))
        assertEquals(AppRoute.PointOperatorStatus, defaultTabFor(UserRole.PointOperator))
    }

    @Test
    fun bilingualTextSelectsFrenchOnlyWhenLanguageIsFrench() {
        assertEquals("Capture", AdlText("Capture", "Capturer").value(Language.En))
        assertEquals("Capturer", AdlText("Capture", "Capturer").value(Language.Fr))
    }

    @Test
    fun routeVisibilityUsesRoleTabs() {
        assertTrue(canShow(AppRoute.AdminReview, UserRole.Admin))
        assertTrue(!canShow(AppRoute.AdminReview, UserRole.Agent))
        assertTrue(canShow(AppRoute.PointOperatorProfile, UserRole.PointOperator))
        assertTrue(!canShow(AppRoute.PointOperatorProfile, UserRole.Client))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest --tests com.africandatalayer.app.model.AdlRolesTest
```

Expected: compile failure because `UserRole`, `AppRoute`, `tabsFor`, `defaultTabFor`, `Language`, `AdlText`, and `canShow` do not exist.

- [ ] **Step 3: Implement role model**

Create `android/app/src/main/java/com/africandatalayer/app/model/AdlRoles.kt`:

```kotlin
package com.africandatalayer.app.model

enum class Language {
    En,
    Fr
}

data class AdlText(
    val en: String,
    val fr: String
) {
    fun value(language: Language): String = when (language) {
        Language.En -> en
        Language.Fr -> fr
    }
}

enum class UserRole(
    val wireValue: String,
    val title: AdlText
) {
    Agent("agent", AdlText("Field Agent", "Agent terrain")),
    Admin("admin", AdlText("Admin Reviewer", "Réviseur admin")),
    Client("client", AdlText("Client", "Client")),
    PointOperator("point_operator", AdlText("Point Operator", "Opérateur du point"));

    companion object {
        fun fromWireValue(value: String?): UserRole =
            entries.firstOrNull { it.wireValue == value } ?: Agent
    }
}

enum class AppRoute(
    val key: String,
    val label: AdlText
) {
    Home("home", AdlText("Home", "Accueil")),
    Contribute("contribute", AdlText("Contribute", "Contribuer")),
    Queue("queue", AdlText("Queue", "File")),
    Rewards("rewards", AdlText("Rewards", "Récompenses")),
    Profile("profile", AdlText("Profile", "Profil")),
    AdminReview("adminReview", AdlText("Review", "Révision")),
    AgentPerformance("agentPerformance", AdlText("Agents", "Agents")),
    ClientDashboard("clientDashboard", AdlText("Delta", "Delta")),
    Investor("investor", AdlText("Investor", "Investisseur")),
    Analytics("analytics", AdlText("Impact", "Impact")),
    PointOperatorStatus("pointOperatorStatus", AdlText("Status", "Statut")),
    PointOperatorProfile("pointOperatorProfile", AdlText("Profile", "Profil"));
}

fun defaultTabFor(role: UserRole): AppRoute = when (role) {
    UserRole.Agent -> AppRoute.Home
    UserRole.Admin -> AppRoute.AdminReview
    UserRole.Client -> AppRoute.ClientDashboard
    UserRole.PointOperator -> AppRoute.PointOperatorStatus
}

fun tabsFor(role: UserRole): List<AppRoute> = when (role) {
    UserRole.Agent -> listOf(AppRoute.Home, AppRoute.Contribute, AppRoute.Analytics, AppRoute.Profile)
    UserRole.Admin -> listOf(AppRoute.AdminReview, AppRoute.Home, AppRoute.Analytics, AppRoute.AgentPerformance, AppRoute.Profile)
    UserRole.Client -> listOf(AppRoute.ClientDashboard, AppRoute.Investor, AppRoute.Home, AppRoute.Analytics, AppRoute.Profile)
    UserRole.PointOperator -> listOf(AppRoute.PointOperatorStatus, AppRoute.PointOperatorProfile)
}

fun canShow(route: AppRoute, role: UserRole): Boolean = tabsFor(role).contains(route)
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest --tests com.africandatalayer.app.model.AdlRolesTest
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/africandatalayer/app/model/AdlRoles.kt android/app/src/test/java/com/africandatalayer/app/model/AdlRolesTest.kt
git commit -m "feat(android): add ADL role routing model"
```

## Task 3: ADL Compose Theme And Shared Components

**Files:**
- Create: `android/app/src/main/java/com/africandatalayer/app/design/AdlTheme.kt`

- [ ] **Step 1: Implement ADL design primitives**

Create `android/app/src/main/java/com/africandatalayer/app/design/AdlTheme.kt`:

```kotlin
package com.africandatalayer.app.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object AdlColor {
    val Navy = Color(0xFF0F2B46)
    val NavyDark = Color(0xFF0B2236)
    val NavyMid = Color(0xFF1D4565)
    val NavyWash = Color(0xFFF2F6FA)
    val NavyBorder = Color(0xFFD5E1EB)
    val Terracotta = Color(0xFFC86B4A)
    val TerraWash = Color(0xFFFFF8F4)
    val Forest = Color(0xFF4C7C59)
    val ForestDark = Color(0xFF3A6145)
    val ForestWash = Color(0xFFEAF3EE)
    val Gold = Color(0xFFF4C317)
    val GoldWash = Color(0xFFFEF9E7)
    val Amber = Color(0xFFD97706)
    val AmberWash = Color(0xFFFEF3C7)
    val Ink = Color(0xFF1F2933)
    val InkMuted = Color(0xFF4B5563)
    val Danger = Color(0xFFC53030)
    val Paper = Color(0xFFF9FAFB)
    val Line = Color(0xFFF3F4F6)
    val LineStrong = Color(0xFFE5E7EB)
}

object AdlRadius {
    val Card = 16.dp
    val Pill = 28.dp
    val StatTile = 14.dp
    val Button = 16.dp
}

object AdlSpace {
    val Xs = 4.dp
    val Sm = 8.dp
    val Md = 12.dp
    val Base = 16.dp
    val Lg = 24.dp
    val Xl = 32.dp
    val Touch = 48.dp
    val PrimaryTouch = 56.dp
}

private val AdlLightColors = lightColorScheme(
    primary = AdlColor.Navy,
    onPrimary = Color.White,
    secondary = AdlColor.Terracotta,
    onSecondary = Color.White,
    tertiary = AdlColor.Gold,
    background = AdlColor.Paper,
    onBackground = AdlColor.Ink,
    surface = Color.White,
    onSurface = AdlColor.Ink,
    error = AdlColor.Danger,
    onError = Color.White
)

@Composable
fun AdlTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AdlLightColors,
        content = content
    )
}

@Composable
fun AdlCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AdlRadius.Card),
        tonalElevation = 0.dp,
        shadowElevation = 1.dp,
        color = Color.White
    ) {
        Box(modifier = Modifier.padding(AdlSpace.Base)) {
            content()
        }
    }
}

@Composable
fun AdlGradientHero(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AdlRadius.Card))
            .background(Brush.linearGradient(listOf(AdlColor.Navy, AdlColor.NavyMid)))
            .padding(20.dp)
    ) {
        content()
    }
}

@Composable
fun AdlSectionHeader(
    text: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = text.uppercase(),
        modifier = modifier,
        color = AdlColor.InkMuted,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.1.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
fun AdlProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    height: Dp = 8.dp,
    tint: Color = AdlColor.Forest
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(height / 2))
            .background(AdlColor.Line)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(progress.coerceIn(0f, 1f))
                .height(height)
                .clip(RoundedCornerShape(height / 2))
                .background(tint)
        )
    }
}

@Composable
fun IdentityCircle(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = 64.dp
) {
    val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "A"
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(AdlColor.Navy, AdlColor.Terracotta))),
        contentAlignment = Alignment.Center
    ) {
        Text(initial, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun KpiTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    tone: Color = AdlColor.Navy,
    wash: Color = AdlColor.NavyWash
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(AdlRadius.StatTile))
            .background(wash)
            .padding(AdlSpace.Md)
    ) {
        Text(value, color = tone, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(4.dp))
        Text(
            label.uppercase(),
            color = tone.copy(alpha = 0.72f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.8.sp
        )
    }
}

@Composable
fun StatusPill(
    text: String,
    modifier: Modifier = Modifier,
    background: Color = AdlColor.NavyWash,
    foreground: Color = AdlColor.Navy
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(AdlRadius.Pill))
            .background(background)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(text, color = foreground, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
```

- [ ] **Step 2: Build after adding design primitives**

Run:

```bash
cd android
./gradlew :app:assembleDebug
```

Expected: still fails for missing `MainActivity`; no errors in `AdlTheme.kt`.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/africandatalayer/app/design/AdlTheme.kt
git commit -m "feat(android): add ADL Compose design primitives"
```

## Task 4: App State And Platform Seams

**Files:**
- Create: `android/app/src/main/java/com/africandatalayer/app/state/AppState.kt`
- Create: `android/app/src/main/java/com/africandatalayer/app/platform/PlatformAdapters.kt`
- Create: `android/app/src/test/java/com/africandatalayer/app/state/AppStateTest.kt`

- [ ] **Step 1: Write failing app state tests**

Create `android/app/src/test/java/com/africandatalayer/app/state/AppStateTest.kt`:

```kotlin
package com.africandatalayer.app.state

import com.africandatalayer.app.model.AppRoute
import com.africandatalayer.app.model.Language
import com.africandatalayer.app.model.UserRole
import org.junit.Assert.assertEquals
import org.junit.Test

class AppStateTest {
    @Test
    fun initialStateIsAgentHomeInFrench() {
        val state = AppState.initial()

        assertEquals(UserRole.Agent, state.selectedRole)
        assertEquals(AppRoute.Home, state.selectedRoute)
        assertEquals(Language.Fr, state.language)
    }

    @Test
    fun changingRoleMovesToThatRoleDefaultTab() {
        val state = AppState.initial().selectRole(UserRole.Admin)

        assertEquals(UserRole.Admin, state.selectedRole)
        assertEquals(AppRoute.AdminReview, state.selectedRoute)
    }

    @Test
    fun invalidRouteForRoleFallsBackToDefault() {
        val state = AppState.initial()
            .selectRole(UserRole.PointOperator)
            .selectRoute(AppRoute.AdminReview)

        assertEquals(AppRoute.PointOperatorStatus, state.selectedRoute)
    }

    @Test
    fun languageCanSwitchBetweenEnglishAndFrench() {
        val state = AppState.initial().selectLanguage(Language.En)

        assertEquals(Language.En, state.language)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest --tests com.africandatalayer.app.state.AppStateTest
```

Expected: compile failure because `AppState` does not exist.

- [ ] **Step 3: Implement immutable app state**

Create `android/app/src/main/java/com/africandatalayer/app/state/AppState.kt`:

```kotlin
package com.africandatalayer.app.state

import com.africandatalayer.app.model.AppRoute
import com.africandatalayer.app.model.Language
import com.africandatalayer.app.model.UserRole
import com.africandatalayer.app.model.canShow
import com.africandatalayer.app.model.defaultTabFor

data class AppState(
    val selectedRole: UserRole,
    val selectedRoute: AppRoute,
    val language: Language,
    val isAuthenticated: Boolean,
    val isGuest: Boolean,
    val isOffline: Boolean,
    val syncMessage: String
) {
    fun selectRole(role: UserRole): AppState =
        copy(selectedRole = role, selectedRoute = defaultTabFor(role))

    fun selectRoute(route: AppRoute): AppState =
        if (canShow(route, selectedRole)) copy(selectedRoute = route)
        else copy(selectedRoute = defaultTabFor(selectedRole))

    fun selectLanguage(language: Language): AppState = copy(language = language)

    fun setNetworkState(offline: Boolean): AppState =
        copy(
            isOffline = offline,
            syncMessage = if (offline) "Offline - queued work is preserved" else "Online - ready to sync"
        )

    companion object {
        fun initial(): AppState = AppState(
            selectedRole = UserRole.Agent,
            selectedRoute = AppRoute.Home,
            language = Language.Fr,
            isAuthenticated = false,
            isGuest = true,
            isOffline = false,
            syncMessage = "Ready"
        )
    }
}
```

- [ ] **Step 4: Implement platform seams**

Create `android/app/src/main/java/com/africandatalayer/app/platform/PlatformAdapters.kt`:

```kotlin
package com.africandatalayer.app.platform

data class GeoFix(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val capturedAtMillis: Long
)

data class CapturedPhoto(
    val localUri: String,
    val capturedAtMillis: Long,
    val sizeBytes: Long
)

enum class PermissionState {
    Granted,
    Denied,
    NeedsRationale
}

interface NetworkMonitor {
    fun isOnline(): Boolean
}

interface LocationGateway {
    suspend fun currentFix(): Result<GeoFix>
}

interface CameraGateway {
    suspend fun captureLivePhoto(): Result<CapturedPhoto>
}

interface PermissionGateway {
    fun cameraPermission(): PermissionState
    fun fineLocationPermission(): PermissionState
    fun notificationPermission(): PermissionState
}

interface HapticsGateway {
    fun confirm()
    fun warning()
}

class NoOpNetworkMonitor : NetworkMonitor {
    override fun isOnline(): Boolean = true
}

class NoOpLocationGateway : LocationGateway {
    override suspend fun currentFix(): Result<GeoFix> =
        Result.failure(IllegalStateException("Location gateway not wired in Slice 1"))
}

class NoOpCameraGateway : CameraGateway {
    override suspend fun captureLivePhoto(): Result<CapturedPhoto> =
        Result.failure(IllegalStateException("Camera gateway not wired in Slice 1"))
}

class NoOpPermissionGateway : PermissionGateway {
    override fun cameraPermission(): PermissionState = PermissionState.Denied
    override fun fineLocationPermission(): PermissionState = PermissionState.Denied
    override fun notificationPermission(): PermissionState = PermissionState.Denied
}

class NoOpHapticsGateway : HapticsGateway {
    override fun confirm() = Unit
    override fun warning() = Unit
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest --tests com.africandatalayer.app.state.AppStateTest
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/africandatalayer/app/state/AppState.kt android/app/src/main/java/com/africandatalayer/app/platform/PlatformAdapters.kt android/app/src/test/java/com/africandatalayer/app/state/AppStateTest.kt
git commit -m "feat(android): add app state and platform seams"
```

## Task 5: Compose Activity And All-Role Shell

**Files:**
- Create: `android/app/src/main/java/com/africandatalayer/app/MainActivity.kt`
- Create: `android/app/src/main/java/com/africandatalayer/app/AdlAndroidApp.kt`
- Create: `android/app/src/main/java/com/africandatalayer/app/ui/AppShell.kt`

- [ ] **Step 1: Create activity entry**

Create `android/app/src/main/java/com/africandatalayer/app/MainActivity.kt`:

```kotlin
package com.africandatalayer.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AdlAndroidApp()
        }
    }
}
```

- [ ] **Step 2: Create root app composition**

Create `android/app/src/main/java/com/africandatalayer/app/AdlAndroidApp.kt`:

```kotlin
package com.africandatalayer.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.africandatalayer.app.design.AdlTheme
import com.africandatalayer.app.state.AppState
import com.africandatalayer.app.ui.AppShell

@Composable
fun AdlAndroidApp() {
    var state by remember { mutableStateOf(AppState.initial()) }

    AdlTheme {
        AppShell(
            state = state,
            onStateChange = { state = it }
        )
    }
}
```

- [ ] **Step 3: Create role shell UI**

Create `android/app/src/main/java/com/africandatalayer/app/ui/AppShell.kt`:

```kotlin
package com.africandatalayer.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.africandatalayer.app.design.AdlCard
import com.africandatalayer.app.design.AdlColor
import com.africandatalayer.app.design.AdlGradientHero
import com.africandatalayer.app.design.AdlSectionHeader
import com.africandatalayer.app.design.IdentityCircle
import com.africandatalayer.app.design.KpiTile
import com.africandatalayer.app.design.StatusPill
import com.africandatalayer.app.model.AppRoute
import com.africandatalayer.app.model.Language
import com.africandatalayer.app.model.UserRole
import com.africandatalayer.app.model.tabsFor
import com.africandatalayer.app.state.AppState

@Composable
fun AppShell(
    state: AppState,
    onStateChange: (AppState) -> Unit
) {
    Scaffold(
        containerColor = AdlColor.Paper,
        topBar = {
            AppTopBar(state = state, onStateChange = onStateChange)
        },
        bottomBar = {
            RoleBottomBar(state = state, onStateChange = onStateChange)
        }
    ) { padding ->
        RoleScreen(
            state = state,
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(16.dp)
                .testTag("route-${state.selectedRoute.key}")
        )
    }
}

@Composable
private fun AppTopBar(
    state: AppState,
    onStateChange: (AppState) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .testTag("adl-top-bar")
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            UserRole.entries.forEach { role ->
                Button(
                    onClick = { onStateChange(state.selectRole(role)) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (state.selectedRole == role) AdlColor.Navy else AdlColor.NavyWash,
                        contentColor = if (state.selectedRole == role) Color.White else AdlColor.Navy
                    ),
                    modifier = Modifier.height(48.dp)
                ) {
                    Text(
                        text = role.title.value(state.language),
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onStateChange(state.selectLanguage(Language.Fr)) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.language == Language.Fr) AdlColor.Terracotta else AdlColor.TerraWash,
                    contentColor = if (state.language == Language.Fr) Color.White else AdlColor.Terracotta
                ),
                modifier = Modifier.height(48.dp)
            ) {
                Text("FR")
            }
            Button(
                onClick = { onStateChange(state.selectLanguage(Language.En)) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.language == Language.En) AdlColor.Terracotta else AdlColor.TerraWash,
                    contentColor = if (state.language == Language.En) Color.White else AdlColor.Terracotta
                ),
                modifier = Modifier.height(48.dp)
            ) {
                Text("EN")
            }
            StatusPill(
                text = state.syncMessage,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@Composable
private fun RoleBottomBar(
    state: AppState,
    onStateChange: (AppState) -> Unit
) {
    NavigationBar(
        containerColor = Color.White,
        modifier = Modifier.testTag("role-bottom-bar")
    ) {
        tabsFor(state.selectedRole).forEach { route ->
            NavigationBarItem(
                selected = state.selectedRoute == route,
                onClick = { onStateChange(state.selectRoute(route)) },
                label = {
                    Text(
                        route.label.value(state.language),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                icon = {
                    Text(route.key.take(1).uppercase(), fontWeight = FontWeight.Bold)
                },
                modifier = Modifier.testTag("tab-${route.key}")
            )
        }
    }
}

@Composable
private fun RoleScreen(
    state: AppState,
    modifier: Modifier = Modifier
) {
    val route = state.selectedRoute
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        AdlGradientHero {
            Row {
                IdentityCircle(name = state.selectedRole.title.value(state.language), size = 56.dp)
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(
                        text = route.label.value(state.language),
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = state.selectedRole.title.value(state.language),
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 13.sp
                    )
                }
            }
        }

        AdlSectionHeader(text = if (state.language == Language.Fr) "Fondation native" else "Native foundation")

        AdlCard {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = screenSummary(route, state.language),
                    color = AdlColor.Ink,
                    fontSize = 15.sp,
                    lineHeight = 21.sp
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    KpiTile(
                        label = if (state.language == Language.Fr) "Rôle" else "Role",
                        value = state.selectedRole.wireValue,
                        modifier = Modifier.weight(1f)
                    )
                    KpiTile(
                        label = if (state.language == Language.Fr) "Route" else "Route",
                        value = route.key,
                        modifier = Modifier.weight(1f),
                        tone = AdlColor.ForestDark,
                        wash = AdlColor.ForestWash
                    )
                }
            }
        }
    }
}

private fun screenSummary(route: AppRoute, language: Language): String {
    val english = when (route) {
        AppRoute.Home -> "Map-native field starting point. Full map and point list arrive in the agent slice."
        AppRoute.Contribute -> "Capture shell for live photo, GPS, category, and offline queue flow."
        AppRoute.Queue -> "Offline queue shell for preserved drafts, retries, and sync errors."
        AppRoute.Rewards -> "Rewards shell for XP balance, catalog, wallet, badges, and missions."
        AppRoute.Profile -> "Profile shell for identity, trust tier, language, and sign-out."
        AppRoute.AdminReview -> "Admin review shell for risk-first queue, evidence, and decisions."
        AppRoute.AgentPerformance -> "Agent performance shell for coaching and quality metrics."
        AppRoute.ClientDashboard -> "Client delta shell for weekly changes and confidence summaries."
        AppRoute.Investor -> "Investor shell for high-level trusted coverage and export-ready narrative."
        AppRoute.Analytics -> "Analytics shell for leaderboard, impact, freshness, and quality."
        AppRoute.PointOperatorStatus -> "Point-operator status shell for scoped point updates."
        AppRoute.PointOperatorProfile -> "Point-operator profile shell for password and assignment state."
    }
    val french = when (route) {
        AppRoute.Home -> "Point de départ terrain centré carte. La carte et la liste arrivent dans la tranche agent."
        AppRoute.Contribute -> "Socle capture pour photo live, GPS, catégorie et file hors ligne."
        AppRoute.Queue -> "Socle file hors ligne pour brouillons, reprises et erreurs de sync."
        AppRoute.Rewards -> "Socle récompenses pour XP, catalogue, portefeuille, badges et missions."
        AppRoute.Profile -> "Socle profil pour identité, niveau de confiance, langue et déconnexion."
        AppRoute.AdminReview -> "Socle révision admin pour file par risque, preuves et décisions."
        AppRoute.AgentPerformance -> "Socle performance agent pour coaching et qualité."
        AppRoute.ClientDashboard -> "Socle delta client pour changements hebdo et confiance."
        AppRoute.Investor -> "Socle investisseur pour couverture fiable et narration exportable."
        AppRoute.Analytics -> "Socle analytique pour classement, impact, fraîcheur et qualité."
        AppRoute.PointOperatorStatus -> "Socle statut opérateur pour mises à jour du point assigné."
        AppRoute.PointOperatorProfile -> "Socle profil opérateur pour mot de passe et affectation."
    }
    return if (language == Language.Fr) french else english
}
```

- [ ] **Step 4: Build**

Run:

```bash
cd android
./gradlew :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/africandatalayer/app/MainActivity.kt android/app/src/main/java/com/africandatalayer/app/AdlAndroidApp.kt android/app/src/main/java/com/africandatalayer/app/ui/AppShell.kt
git commit -m "feat(android): add native all-role Compose shell"
```

## Task 6: Compose Shell Smoke Tests

**Files:**
- Create: `android/app/src/androidTest/java/com/africandatalayer/app/ui/AppShellTest.kt`

- [ ] **Step 1: Write Compose UI smoke tests**

Create `android/app/src/androidTest/java/com/africandatalayer/app/ui/AppShellTest.kt`:

```kotlin
package com.africandatalayer.app.ui

import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.africandatalayer.app.MainActivity
import org.junit.Rule
import org.junit.Test

class AppShellTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun launchesAgentHomeByDefault() {
        compose.onNodeWithTag("adl-top-bar").assertExists()
        compose.onNodeWithTag("role-bottom-bar").assertExists()
        compose.onNodeWithTag("route-home").assertExists()
        compose.onNodeWithText("Accueil").assertExists()
    }

    @Test
    fun adminRoleShowsAdminReviewRoute() {
        compose.onNodeWithText("Réviseur admin").performClick()
        compose.onNodeWithTag("route-adminReview").assertExists()
        compose.onNodeWithTag("tab-agentPerformance").assertExists()
    }

    @Test
    fun clientRoleShowsClientDashboardRoute() {
        compose.onNodeWithText("Client").performClick()
        compose.onNodeWithTag("route-clientDashboard").assertExists()
        compose.onNodeWithTag("tab-investor").assertExists()
    }

    @Test
    fun pointOperatorRoleShowsTwoTabShell() {
        compose.onNodeWithText("Opérateur du point").performClick()
        compose.onNodeWithTag("route-pointOperatorStatus").assertExists()
        compose.onNodeWithTag("tab-pointOperatorProfile").assertExists()
    }

    @Test
    fun languageToggleSwitchesVisibleCopy() {
        compose.onNodeWithText("EN").performClick()
        compose.onNodeWithText("Home").assertExists()
        compose.onNodeWithText("Field Agent").assertExists()
    }
}
```

- [ ] **Step 2: Run unit tests and debug build**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Run instrumented tests if an emulator/device is available**

Run:

```bash
cd android
./gradlew :app:connectedDebugAndroidTest
```

Expected with emulator/device: `BUILD SUCCESSFUL`. If no emulator/device is available, record the exact Gradle error in the bead notes and do not mark this step as verified.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/androidTest/java/com/africandatalayer/app/ui/AppShellTest.kt
git commit -m "test(android): cover native all-role shell smoke paths"
```

## Task 7: Verification, Bead Update, And Handoff

**Files:**
- Modify: `.beads/issues.jsonl` through `bd update`

- [ ] **Step 1: Run full Slice 1 gate**

Run:

```bash
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

If an emulator/device is connected, also run:

```bash
cd android
./gradlew :app:connectedDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Inspect git diff for scope**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only Android native scaffold files and `.beads/issues.jsonl` are changed since the last Slice 1 task commit.

- [ ] **Step 3: Update bead**

Run:

```bash
bd update africandatalayer-sw4 --notes "Slice 1 complete: native Gradle/Kotlin/Compose scaffold, ADL design tokens, all-role shell, role routing tests, app-state tests, platform seams, and Compose smoke tests. Verified :app:testDebugUnitTest and :app:assembleDebug. connectedDebugAndroidTest result recorded separately depending on emulator availability." --json
```

If `connectedDebugAndroidTest` was not run, replace the final sentence with the actual reason, for example:

```bash
bd update africandatalayer-sw4 --notes "Slice 1 complete: native Gradle/Kotlin/Compose scaffold, ADL design tokens, all-role shell, role routing tests, app-state tests, platform seams, and Compose smoke tests. Verified :app:testDebugUnitTest and :app:assembleDebug. connectedDebugAndroidTest not run because no emulator/device was connected." --json
```

- [ ] **Step 4: Commit bead update**

```bash
git add .beads/issues.jsonl
git commit -m "chore(android): record native foundation verification"
```

- [ ] **Step 5: Push**

```bash
git pull --rebase --autostash
bd dolt push
git push
git status --short --branch
```

Expected: branch is up to date with `origin/main`. Pre-existing unrelated local files may remain unstaged.

## Self-Review Checklist

- Spec coverage: Slice 1 covers native foundation, all-role routing, ADL tokens, language state, platform seams, and smoke tests from the approved design.
- Completeness scan: no incomplete file paths or unnamed handlers are present.
- Type consistency: route names, role names, package names, test tags, and function names match across tests and implementation snippets.
- Scope control: agent/admin/client/point-operator business workflows are represented as shell routes only; full workflow implementation is intentionally deferred to separate role-surface plans.
