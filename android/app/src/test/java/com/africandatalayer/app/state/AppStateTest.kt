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
