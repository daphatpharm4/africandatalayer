import Foundation

/// Seam between the capture flow's device-adaptive behavior (e.g. skipping
/// heavy on-device work on low-end hardware) and `sysctlbyname`/`UIDevice`/
/// `ProcessInfo` — mirrors the injectable `LocationServiceProtocol`/
/// `CoreLocationService` and `PhotoIntegrityProviding`/
/// `CoreImagePhotoIntegrityProvider` pattern used elsewhere in this app so
/// device-profiling logic (in particular the low-end heuristic) can be
/// tested without depending on the hardware the tests happen to run on.
protocol DeviceProfilingProviding: Sendable {
    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile
}

struct DeviceProfile: Equatable, Sendable, Codable {
    var model: String
    var systemVersion: String
    var totalMemoryMB: UInt64
    var isLowPowerMode: Bool
    var thermalState: String
    var lowEndDevice: Bool
    var language: String
}

/// Production `DeviceProfilingProviding` backed by `sysctlbyname("hw.machine")`
/// for the model identifier and `ProcessInfo` for the rest. The
/// individual system reads are injectable closures (all defaulted to the
/// real system calls) so `DeviceProfilingProviderTests` can drive the
/// low-end heuristic deterministically instead of depending on whatever
/// simulator/device happens to run the test.
final class SystemDeviceProfilingProvider: DeviceProfilingProviding {
    private let lowMemoryThresholdMB: UInt64 = 2_048
    private let lowEndModels: Set<String> = [
        "iPhone8,1", "iPhone8,2",     // iPhone 6s, 6s Plus
        "iPhone8,4",                   // iPhone SE (1st gen)
        "iPhone9,1", "iPhone9,3",     // iPhone 7
        "iPhone9,2", "iPhone9,4",     // iPhone 7 Plus
    ]

    private let readMachineModel: @Sendable () -> String
    private let readSystemVersion: @Sendable () -> String
    private let readPhysicalMemoryBytes: @Sendable () -> UInt64
    private let readIsLowPowerModeEnabled: @Sendable () -> Bool
    private let readThermalState: @Sendable () -> ProcessInfo.ThermalState

    init(
        readMachineModel: @escaping @Sendable () -> String = SystemDeviceProfilingProvider.readMachineModelFromSysctl,
        readSystemVersion: @escaping @Sendable () -> String = SystemDeviceProfilingProvider.readSystemVersionFromDevice,
        readPhysicalMemoryBytes: @escaping @Sendable () -> UInt64 = { ProcessInfo.processInfo.physicalMemory },
        readIsLowPowerModeEnabled: @escaping @Sendable () -> Bool = { ProcessInfo.processInfo.isLowPowerModeEnabled },
        readThermalState: @escaping @Sendable () -> ProcessInfo.ThermalState = { ProcessInfo.processInfo.thermalState }
    ) {
        self.readMachineModel = readMachineModel
        self.readSystemVersion = readSystemVersion
        self.readPhysicalMemoryBytes = readPhysicalMemoryBytes
        self.readIsLowPowerModeEnabled = readIsLowPowerModeEnabled
        self.readThermalState = readThermalState
    }

    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile {
        let model = readMachineModel()
        let memoryMB = readPhysicalMemoryBytes() / 1_024 / 1_024
        let thermalState = Self.thermalStateString(readThermalState())
        let isLowEnd = lowEndModels.contains(model) || memoryMB < lowMemoryThresholdMB

        return DeviceProfile(
            model: model,
            systemVersion: readSystemVersion(),
            totalMemoryMB: memoryMB,
            isLowPowerMode: readIsLowPowerModeEnabled(),
            thermalState: thermalState,
            lowEndDevice: isLowEnd,
            language: language.rawValue
        )
    }

    static func readMachineModelFromSysctl() -> String {
        var size = 0
        sysctlbyname("hw.machine", nil, &size, nil, 0)
        guard size > 0 else { return readSystemVersionFallbackModel() }
        var machine = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.machine", &machine, &size, nil, 0)
        return String(cString: machine).trimmingCharacters(in: .controlCharacters)
    }

    static func readSystemVersionFromDevice() -> String {
        return ProcessInfo.processInfo.operatingSystemVersionString
    }

    private static func readSystemVersionFallbackModel() -> String {
        return "unknown"
    }

    private static func thermalStateString(_ state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "nominal"
        }
    }
}
