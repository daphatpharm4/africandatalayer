package com.africandatalayer.app.state

import com.africandatalayer.app.model.AppRoute
import com.africandatalayer.app.model.Language
import com.africandatalayer.app.model.UserRole
import com.africandatalayer.app.model.canShow
import com.africandatalayer.app.model.defaultTabFor

enum class SyncStatus {
    Ready,
    Offline,
    Online;

    fun title(language: Language): String = when (this) {
        Ready -> if (language == Language.Fr) "Prêt" else "Ready"
        Offline -> if (language == Language.Fr) {
            "Hors ligne — le travail en attente est conservé"
        } else {
            "Offline — queued work is preserved"
        }
        Online -> if (language == Language.Fr) {
            "En ligne — prêt à synchroniser"
        } else {
            "Online — ready to sync"
        }
    }
}

data class AppState(
    val selectedRole: UserRole,
    val selectedRoute: AppRoute,
    val language: Language,
    val isAuthenticated: Boolean,
    val isGuest: Boolean,
    val isOffline: Boolean,
    val syncStatus: SyncStatus
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
            syncStatus = if (offline) SyncStatus.Offline else SyncStatus.Online
        )

    companion object {
        fun initial(): AppState = AppState(
            selectedRole = UserRole.Agent,
            selectedRoute = AppRoute.Home,
            language = Language.Fr,
            isAuthenticated = false,
            isGuest = true,
            isOffline = false,
            syncStatus = SyncStatus.Ready
        )
    }
}
