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
