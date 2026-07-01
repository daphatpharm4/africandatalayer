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
