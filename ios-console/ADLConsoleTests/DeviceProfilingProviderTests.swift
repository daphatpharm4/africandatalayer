@testable import ADLConsole
import Foundation
import XCTest

/// Coverage for `DeviceProfilingProviding` / `SystemDeviceProfilingProvider`:
/// the default (real system-call) path returns populated values, and the
/// injected-closure path drives the low-end heuristic and thermal-state
/// mapping deterministically, mirroring how `MockLocationService` avoids
/// depending on real hardware/permissions.
final class DeviceProfilingProviderTests: XCTestCase {
    // MARK: - Default (real system calls)

    func testDeviceProfileReturnsPopulatedValues() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        XCTAssertFalse(profile.model.isEmpty)
        XCTAssertFalse(profile.systemVersion.isEmpty)
        XCTAssertGreaterThan(profile.totalMemoryMB, 0)
    }

    func testDeviceProfileLowEndDetectionBelow2GB() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        // On real hardware this will be false for modern devices.
        // The heuristic: < 2048 MB = low end.
        let expectedLowEnd = profile.totalMemoryMB < 2048
        XCTAssertEqual(profile.lowEndDevice, expectedLowEnd)
    }

    func testDeviceProfileIncludesLanguage() {
        let provider = SystemDeviceProfilingProvider()
        let enProfile = provider.deviceProfile(language: .en)
        let frProfile = provider.deviceProfile(language: .fr)
        XCTAssertEqual(enProfile.language, "en")
        XCTAssertEqual(frProfile.language, "fr")
    }

    func testDeviceProfileThermalStateIsKnown() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        let validStates = ["nominal", "fair", "serious", "critical"]
        XCTAssertTrue(validStates.contains(profile.thermalState))
    }

    // MARK: - Injected (deterministic) low-end heuristic

    func testLowMemoryBelowThresholdIsLowEnd() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone16,1" },
            readSystemVersion: { "17.0" },
            readPhysicalMemoryBytes: { 1_536 * 1_024 * 1_024 }, // 1.5 GB
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .nominal }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertEqual(profile.totalMemoryMB, 1_536)
        XCTAssertTrue(profile.lowEndDevice)
    }

    func testHighMemoryAboveThresholdIsNotLowEnd() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone16,1" },
            readSystemVersion: { "17.0" },
            readPhysicalMemoryBytes: { 6 * 1_024 * 1_024 * 1_024 }, // 6 GB
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .nominal }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertEqual(profile.totalMemoryMB, 6 * 1_024)
        XCTAssertFalse(profile.lowEndDevice)
    }

    func testMemoryExactlyAtThresholdIsNotLowEnd() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone16,1" },
            readSystemVersion: { "17.0" },
            readPhysicalMemoryBytes: { 2_048 * 1_024 * 1_024 }, // exactly 2GB
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .nominal }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertEqual(profile.totalMemoryMB, 2_048)
        XCTAssertFalse(profile.lowEndDevice, "2048MB is the boundary; only strictly < 2048 counts as low-end")
    }

    func testKnownLowEndModelIsLowEndEvenWithAmpleMemory() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone8,1" }, // iPhone 6s
            readSystemVersion: { "15.8" },
            readPhysicalMemoryBytes: { 6 * 1_024 * 1_024 * 1_024 }, // 6GB, hypothetically
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .nominal }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertTrue(profile.lowEndDevice, "known low-end model identifiers force lowEndDevice regardless of memory")
    }

    func testUnknownModernModelIsNotLowEnd() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone17,2" },
            readSystemVersion: { "18.0" },
            readPhysicalMemoryBytes: { 8 * 1_024 * 1_024 * 1_024 },
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .nominal }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertFalse(profile.lowEndDevice)
    }

    // MARK: - Injected (deterministic) passthrough fields

    func testIsLowPowerModePassesThrough() {
        let onProvider = SystemDeviceProfilingProvider(
            readPhysicalMemoryBytes: { 4 * 1_024 * 1_024 * 1_024 },
            readIsLowPowerModeEnabled: { true }
        )
        XCTAssertTrue(onProvider.deviceProfile(language: .en).isLowPowerMode)

        let offProvider = SystemDeviceProfilingProvider(
            readPhysicalMemoryBytes: { 4 * 1_024 * 1_024 * 1_024 },
            readIsLowPowerModeEnabled: { false }
        )
        XCTAssertFalse(offProvider.deviceProfile(language: .en).isLowPowerMode)
    }

    func testThermalStateMapsAllKnownCases() {
        let cases: [(ProcessInfo.ThermalState, String)] = [
            (.nominal, "nominal"),
            (.fair, "fair"),
            (.serious, "serious"),
            (.critical, "critical"),
        ]
        for (state, expected) in cases {
            let provider = SystemDeviceProfilingProvider(readThermalState: { state })
            XCTAssertEqual(provider.deviceProfile(language: .en).thermalState, expected)
        }
    }

    func testModelAndSystemVersionPassThrough() {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone16,1" },
            readSystemVersion: { "17.5.1" }
        )
        let profile = provider.deviceProfile(language: .en)
        XCTAssertEqual(profile.model, "iPhone16,1")
        XCTAssertEqual(profile.systemVersion, "17.5.1")
    }

    // MARK: - Codable / Equatable

    func testDeviceProfileRoundTripsThroughCodable() throws {
        let provider = SystemDeviceProfilingProvider(
            readMachineModel: { "iPhone16,1" },
            readSystemVersion: { "17.5" },
            readPhysicalMemoryBytes: { 4 * 1_024 * 1_024 * 1_024 },
            readIsLowPowerModeEnabled: { false },
            readThermalState: { .fair }
        )
        let profile = provider.deviceProfile(language: .fr)
        let encoded = try JSONEncoder().encode(profile)
        let decoded = try JSONDecoder().decode(DeviceProfile.self, from: encoded)
        XCTAssertEqual(decoded, profile)
    }
}
