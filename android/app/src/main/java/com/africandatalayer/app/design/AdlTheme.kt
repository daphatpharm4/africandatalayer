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
