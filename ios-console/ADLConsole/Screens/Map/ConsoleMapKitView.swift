import ConsoleForms
import ConsoleModels
import CoreLocation
import MapKit
import SwiftUI

final class ConsoleCachedTileOverlay: MKTileOverlay {
    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.requestCachePolicy = .returnCacheDataElseLoad
        cfg.urlCache = URLCache.shared
        return URLSession(configuration: cfg)
    }()

    override func loadTile(at path: MKTileOverlayPath, result: @escaping (Data?, Error?) -> Void) {
        let request = URLRequest(url: url(forTilePath: path),
                                 cachePolicy: .returnCacheDataElseLoad,
                                 timeoutInterval: 20)
        session.dataTask(with: request) { data, _, error in
            result(data, error)
        }.resume()
    }
}

@MainActor
final class ConsoleMapHolder {
    static let shared = ConsoleMapHolder()
    var mapView: MKMapView?
}

final class ConsolePointAnnotation: NSObject, MKAnnotation {
    var point: CollapsedPlatformPoint

    var coordinate: CLLocationCoordinate2D {
        point.representative.evidence.gps.map {
            CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
        } ?? CLLocationCoordinate2D(latitude: 0, longitude: 0)
    }

    var title: String? {
        point.representative.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized
    }

    init(point: CollapsedPlatformPoint) {
        self.point = point
    }
}

final class ConsolePointAnnotationView: MKAnnotationView {
    private static let markerDiameter: CGFloat = 18
    private static let hitInset: CGFloat = -13

    private static let palette: [UIColor] = [
        UIColor(red: 15/255, green: 43/255, blue: 70/255, alpha: 1),
        UIColor(red: 76/255, green: 124/255, blue: 89/255, alpha: 1),
        UIColor(red: 200/255, green: 107/255, blue: 74/255, alpha: 1),
        UIColor(red: 244/255, green: 195/255, blue: 23/255, alpha: 1),
    ]

    override var annotation: MKAnnotation? {
        didSet { configure() }
    }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        configureBase()
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configureBase()
        configure()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.width / 2
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: Self.hitInset, dy: Self.hitInset).contains(point)
    }

    private func configureBase() {
        bounds = CGRect(x: 0, y: 0, width: Self.markerDiameter, height: Self.markerDiameter)
        backgroundColor = .clear
        canShowCallout = false
        collisionMode = .circle
        layer.borderWidth = 2
        layer.borderColor = UIColor.white.cgColor
        layer.shadowColor = UIColor(red: 15/255, green: 43/255, blue: 70/255, alpha: 1).cgColor
        layer.shadowOpacity = 0.28
        layer.shadowRadius = 5
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.masksToBounds = false
    }

    private func configure() {
        guard let consoleAnnotation = annotation as? ConsolePointAnnotation else { return }
        let key = consoleAnnotation.point.representative.recordTypeKey
        layer.backgroundColor = Self.palette[Self.stableIndex(for: key)].cgColor
        displayPriority = .defaultHigh
    }

    /// Deterministic (process-stable) palette index for a record type. Swift's
    /// `String.hashValue` is seeded per launch, so a hash-based color would
    /// change on every app start; a djb2 digest over the UTF-8 bytes keeps each
    /// record type on the same brand color across launches and devices.
    private static func stableIndex(for key: String) -> Int {
        guard !palette.isEmpty else { return 0 }
        var hash: UInt64 = 5381
        for byte in key.utf8 { hash = (hash &* 33) &+ UInt64(byte) }
        return Int(hash % UInt64(palette.count))
    }
}

struct ConsoleMapKitView: UIViewRepresentable {
    let points: [CollapsedPlatformPoint]
    @Binding var region: MKCoordinateRegion
    @Binding var selectedPoint: CollapsedPlatformPoint?

    func makeUIView(context: Context) -> MKMapView {
        if let cached = ConsoleMapHolder.shared.mapView {
            cached.delegate = context.coordinator
            return cached
        }

        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.mapType = .standard
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.showsUserLocation = true
        mapView.setRegion(region, animated: false)

        let cartoTiles = ConsoleCachedTileOverlay(
            urlTemplate: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        )
        cartoTiles.canReplaceMapContent = true
        mapView.addOverlay(cartoTiles, level: .aboveLabels)

        ConsoleMapHolder.shared.mapView = mapView
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self

        if !mapView.region.isClose(to: region) {
            mapView.setRegion(region, animated: true)
        }

        let existingAnnotations = mapView.annotations.compactMap { $0 as? ConsolePointAnnotation }
        let nextIds = Set(points.map(\.id))
        let staleAnnotations = existingAnnotations.filter { !nextIds.contains($0.point.id) }
        if !staleAnnotations.isEmpty {
            mapView.removeAnnotations(staleAnnotations)
        }

        let existingIds = Set(existingAnnotations.map(\.point.id))
        let pointsById = Dictionary(points.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for annotation in existingAnnotations {
            if let nextPoint = pointsById[annotation.point.id], nextPoint != annotation.point {
                annotation.point = nextPoint
            }
        }
        let newAnnotations = points
            .filter { !existingIds.contains($0.id) }
            .map(ConsolePointAnnotation.init(point:))
        if !newAnnotations.isEmpty {
            mapView.addAnnotations(newAnnotations)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: ConsoleMapKitView

        init(parent: ConsoleMapKitView) {
            self.parent = parent
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            DispatchQueue.main.async {
                self.parent.region = mapView.region
            }
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            guard let annotation = view.annotation as? ConsolePointAnnotation else { return }
            mapView.deselectAnnotation(annotation, animated: false)
            DispatchQueue.main.async {
                self.parent.selectedPoint = annotation.point
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard annotation is ConsolePointAnnotation else { return nil }

            let identifier = "console-point-dot"
            let dotView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? ConsolePointAnnotationView
                ?? ConsolePointAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            dotView.annotation = annotation
            return dotView
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let tileOverlay = overlay as? MKTileOverlay {
                return MKTileOverlayRenderer(tileOverlay: tileOverlay)
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

private extension MKCoordinateRegion {
    func isClose(to other: MKCoordinateRegion) -> Bool {
        abs(center.latitude - other.center.latitude) < 0.000_08 &&
            abs(center.longitude - other.center.longitude) < 0.000_08 &&
            abs(span.latitudeDelta - other.span.latitudeDelta) < 0.000_08 &&
            abs(span.longitudeDelta - other.span.longitudeDelta) < 0.000_08
    }
}
