import ConsoleForms
import CoreLocation
import Foundation

/// Errors surfaced by `LocationServiceProtocol.requestOneShotLocation`.
enum LocationServiceError: Error, Equatable, Sendable {
    case permissionDenied
    case unavailable
    case timedOut

    func message(_ language: ConsoleLanguage) -> String {
        switch self {
        case .permissionDenied:
            return language.t(
                "Location access is denied. Enable it in Settings to capture GPS evidence.",
                "L'accès à la position est refusé. Activez-le dans Réglages pour capturer la position GPS."
            )
        case .unavailable:
            return language.t("Location is unavailable right now.", "La position est indisponible pour le moment.")
        case .timedOut:
            return language.t("Could not get a GPS fix in time. Try again.", "Impossible d'obtenir une position GPS à temps. Réessayez.")
        }
    }
}

/// Seam between the capture flow's GPS-evidence button and CoreLocation —
/// mirrors the injectable `AuthServiceProtocol` / `PlatformTransport`
/// pattern used elsewhere in this app so `CaptureViewModel` can be tested
/// with a canned fix instead of driving real hardware.
protocol LocationServiceProtocol: Sendable {
    func requestOneShotLocation() async throws -> FormGpsValue
}

/// Production `LocationServiceProtocol` backed by `CLLocationManager`.
/// Requests when-in-use authorization if not yet determined, then resolves
/// with the first fix `CLLocationManager` reports (or throws once denied /
/// restricted / no fix arrives).
final class CoreLocationService: NSObject, LocationServiceProtocol, CLLocationManagerDelegate, @unchecked Sendable {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<FormGpsValue, Error>?
    private let lock = NSLock()

    override init() {
        super.init()
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestOneShotLocation() async throws -> FormGpsValue {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            self.continuation = continuation
            lock.unlock()
            DispatchQueue.main.async {
                self.manager.delegate = self
                let status = self.manager.authorizationStatus
                switch status {
                case .notDetermined:
                    self.manager.requestWhenInUseAuthorization()
                case .denied, .restricted:
                    self.finish(.failure(LocationServiceError.permissionDenied))
                case .authorizedWhenInUse, .authorizedAlways:
                    self.manager.requestLocation()
                @unknown default:
                    self.manager.requestLocation()
                }
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            finish(.failure(LocationServiceError.permissionDenied))
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            finish(.failure(LocationServiceError.unavailable))
            return
        }
        let value = FormGpsValue(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracyMeters: location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil
        )
        finish(.success(value))
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish(.failure(LocationServiceError.unavailable))
    }

    private func finish(_ result: Result<FormGpsValue, Error>) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        guard let pending else { return }
        switch result {
        case .success(let value): pending.resume(returning: value)
        case .failure(let error): pending.resume(throwing: error)
        }
    }
}
