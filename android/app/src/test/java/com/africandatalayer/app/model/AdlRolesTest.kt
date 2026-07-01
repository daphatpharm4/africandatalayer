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
