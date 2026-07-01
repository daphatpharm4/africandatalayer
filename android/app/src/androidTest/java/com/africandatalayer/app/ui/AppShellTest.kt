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
