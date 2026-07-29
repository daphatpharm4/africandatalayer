import ConsoleModels
import MapKit
import UIKit

/// `MKOverlay` wrapping derived `HeatMapCell`s (`ConsoleModels` —
/// client-side composed from `GeohashScore`s, see
/// `CompanyMapViewModel.heatCells`) for `CompanyMapView`'s "Heat" overlay
/// mode.
final class HeatMapOverlay: NSObject, MKOverlay {
    /// Fixed real-world footprint radius drawn around each cell's peak
    /// intensity, in meters — roughly a geohash-6 cell's own width at the
    /// pilot's latitude, so adjacent hot cells visually blend into a
    /// contiguous blob rather than reading as isolated dots.
    static let radiusMeters: CLLocationDistance = 220

    let cells: [HeatMapCell]
    let coordinate: CLLocationCoordinate2D
    let boundingMapRect: MKMapRect

    init(cells: [HeatMapCell]) {
        self.cells = cells
        var rect = MKMapRect.null
        for cell in cells {
            let mapPoint = MKMapPoint(CLLocationCoordinate2D(latitude: cell.latitude, longitude: cell.longitude))
            let radiusInMapPoints = Self.radiusMeters * MKMapPointsPerMeterAtLatitude(cell.latitude)
            let padded = MKMapRect(
                x: mapPoint.x - radiusInMapPoints,
                y: mapPoint.y - radiusInMapPoints,
                width: radiusInMapPoints * 2,
                height: radiusInMapPoints * 2
            )
            rect = rect.union(padded)
        }
        self.boundingMapRect = rect
        self.coordinate = rect.isNull
            ? CLLocationCoordinate2D(latitude: 0, longitude: 0)
            : MKMapPoint(x: rect.midX, y: rect.midY).coordinate
        super.init()
    }
}

/// Draws each cell as a soft radial gradient (terra, fading to transparent),
/// radius and peak alpha scaled by `intensity` normalized against the
/// batch's own min/max (`IntensityNormalization`, `ConsoleModels`).
///
/// No existing `MKOverlayRenderer` in this codebase draws a density/heat
/// layer (`ConsoleMapKitView`'s only prior renderer is the base tile
/// overlay) — this intentionally stays a simple per-cell radial gradient
/// rather than a rasterized kernel-density blend, which is enough to read
/// hot spots at the pilot's scale (dozens, not thousands, of cells per
/// vertical) without the cost/complexity of an offscreen bitmap pass.
final class HeatMapRenderer: MKOverlayRenderer {
    private let heatOverlay: HeatMapOverlay
    private let minIntensity: Double
    private let maxIntensity: Double
    private let colorSpace = CGColorSpaceCreateDeviceRGB()

    init(overlay: HeatMapOverlay) {
        self.heatOverlay = overlay
        let intensities = overlay.cells.map(\.intensity)
        self.minIntensity = intensities.min() ?? 0
        self.maxIntensity = intensities.max() ?? 0
        super.init(overlay: overlay)
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        for cell in heatOverlay.cells {
            let normalized = IntensityNormalization.normalize(cell.intensity, minValue: minIntensity, maxValue: maxIntensity)

            let centerMapPoint = MKMapPoint(CLLocationCoordinate2D(latitude: cell.latitude, longitude: cell.longitude))
            let centerPoint = point(for: centerMapPoint)

            // Radius is specified in map points (the renderer's own drawing
            // space, pre-`point(for:)`) rather than divided/multiplied by
            // `zoomScale` — the context's CTM already applies `zoomScale` to
            // everything drawn here, so a fixed map-point radius naturally
            // grows on screen as the user zooms in, tracking a fixed
            // real-world footprint (unlike `lineWidth`, which is specified
            // in the CTM's *pre*-scale user space and must be divided by
            // `zoomScale` to stay a constant on-screen width).
            let radiusInMapPoints = HeatMapOverlay.radiusMeters
                * (0.5 + normalized * 0.5)
                * MKMapPointsPerMeterAtLatitude(cell.latitude)
            let radiusInPoints = CGFloat(radiusInMapPoints)
            guard radiusInPoints.isFinite, radiusInPoints > 0 else { continue }

            let peakAlpha = 0.18 + normalized * 0.5
            let colorComponents: [CGFloat] = [
                200 / 255, 107 / 255, 74 / 255, peakAlpha,
                200 / 255, 107 / 255, 74 / 255, 0
            ]
            guard let gradient = CGGradient(
                colorSpace: colorSpace,
                colorComponents: colorComponents,
                locations: [0, 1],
                count: 2
            ) else { continue }

            context.drawRadialGradient(
                gradient,
                startCenter: centerPoint,
                startRadius: 0,
                endCenter: centerPoint,
                endRadius: radiusInPoints,
                options: []
            )
        }
    }
}
