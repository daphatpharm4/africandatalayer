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
        if (canShow(route, selectedRole)) {
            copy(selectedRoute = route)
        } else {
            copy(selectedRoute = defaultTabFor(selectedRole))
        }

    fun selectLanguage(language: Language): AppState = copy(language = language)

    fun setNetworkState(offline: Boolean): AppState =
        copy(
            isOffline = offline,
            syncMessage = if (offline) {
                "Offline - queued work is preserved"
            } else {
                "Online - ready to sync"
            }
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
