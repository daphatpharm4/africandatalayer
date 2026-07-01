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
