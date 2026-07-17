package com.africandatalayer.app.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
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
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.horizontalScroll(rememberScrollState())
        ) {
            UserRole.entries.forEach { role ->
                Button(
                    onClick = { onStateChange(state.selectRole(role)) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (state.selectedRole == role) {
                            AdlColor.Navy
                        } else {
                            AdlColor.NavyWash
                        },
                        contentColor = if (state.selectedRole == role) {
                            Color.White
                        } else {
                            AdlColor.Navy
                        }
                    ),
                    modifier = Modifier
                        .height(48.dp)
                        .widthIn(min = 96.dp)
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
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.horizontalScroll(rememberScrollState())
        ) {
            Button(
                onClick = { onStateChange(state.selectLanguage(Language.Fr)) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.language == Language.Fr) {
                        AdlColor.Terracotta
                    } else {
                        AdlColor.TerraWash
                    },
                    contentColor = if (state.language == Language.Fr) {
                        Color.White
                    } else {
                        AdlColor.Terracotta
                    }
                ),
                modifier = Modifier.height(48.dp)
            ) {
                Text("FR")
            }
            Button(
                onClick = { onStateChange(state.selectLanguage(Language.En)) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.language == Language.En) {
                        AdlColor.Terracotta
                    } else {
                        AdlColor.TerraWash
                    },
                    contentColor = if (state.language == Language.En) {
                        Color.White
                    } else {
                        AdlColor.Terracotta
                    }
                ),
                modifier = Modifier.height(48.dp)
            ) {
                Text("EN")
            }
            StatusPill(
                text = state.syncStatus.title(state.language),
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

        AdlSectionHeader(
            text = if (state.language == Language.Fr) {
                "Aujourd'hui"
            } else {
                "Today"
            }
        )

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
                        label = if (state.language == Language.Fr) "Accès" else "Access",
                        value = state.selectedRole.wireValue,
                        modifier = Modifier.weight(1f)
                    )
                    KpiTile(
                        label = if (state.language == Language.Fr) "Vue" else "View",
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
        AppRoute.Home -> "Bonamoussadi coverage, nearby points, and field momentum in one map-native view."
        AppRoute.Contribute -> "Live photo, GPS, category, and saved draft state for field capture."
        AppRoute.Queue -> "Preserved drafts, retries, and sync issues stay visible until resolved."
        AppRoute.Rewards -> "XP balance, missions, badges, and reward wallet reinforce verified quality."
        AppRoute.Profile -> "Identity, trust tier, language, and account status stay together."
        AppRoute.AdminReview -> "Risk-first queue, evidence, and decisions stay close for fast review."
        AppRoute.AgentPerformance -> "Agent quality, freshness, and coaching signals stay scan-ready."
        AppRoute.ClientDashboard -> "Weekly deltas, confidence, and vertical movement lead the story."
        AppRoute.Investor -> "Trusted coverage and market progress stay presentation-ready."
        AppRoute.Analytics -> "Leaderboard, impact, freshness, and quality stay connected."
        AppRoute.PointOperatorStatus -> "Assigned point status updates stay scoped and current."
        AppRoute.PointOperatorProfile -> "Operator identity, password state, and assignment context stay clear."
    }
    val french = when (route) {
        AppRoute.Home -> "Couverture Bonamoussadi, points proches et élan terrain dans une vue carte."
        AppRoute.Contribute -> "Photo live, GPS, catégorie et brouillon sauvegardé pour la capture terrain."
        AppRoute.Queue -> "Brouillons, reprises et problèmes de synchronisation restent visibles."
        AppRoute.Rewards -> "XP, missions, badges et portefeuille valorisent la qualité vérifiée."
        AppRoute.Profile -> "Identité, niveau de confiance, langue et statut du compte restent groupés."
        AppRoute.AdminReview -> "File par risque, preuves et décisions restent proches pour réviser vite."
        AppRoute.AgentPerformance -> "Qualité agent, fraîcheur et coaching restent faciles à scanner."
        AppRoute.ClientDashboard -> "Deltas hebdo, confiance et mouvement par vertical ouvrent l'histoire."
        AppRoute.Investor -> "Couverture fiable et progrès marché restent prêts pour présentation."
        AppRoute.Analytics -> "Classement, impact, fraîcheur et qualité restent connectés."
        AppRoute.PointOperatorStatus -> "Les mises à jour du point assigné restent cadrées et fraîches."
        AppRoute.PointOperatorProfile -> "Identité opérateur, mot de passe et affectation restent clairs."
    }
    return if (language == Language.Fr) french else english
}
