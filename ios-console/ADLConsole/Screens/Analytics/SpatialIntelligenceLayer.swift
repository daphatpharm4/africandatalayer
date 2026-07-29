import ConsoleModels
import MapKit
import UIKit

/// `MKOverlay` wrapping opportunity-scored geohash cells (`GeohashScore`
/// from `GET api/analytics?view=spatial_intelligence`, `ConsoleModels`) for
/// `CompanyMapView`'s "Grid" overlay mode. Each cell's `cellId` IS its
/// geohash (server always encodes at precision 6 — see
/// `AnalyticsRepository.spatialIntelligence`'s doc comment) so the polygon
/// corners come straight from decoding it (`GeohashGeometry.polygonRing`,
/// `ConsoleModels`) with no separate cell-size parameter needed.
final class GeohashGridOverlay: NSObject, MKOverlay {
    let cells: [GeohashScore]
    let coordinate: CLLocationCoordinate2D
    let boundingMapRect: MKMapRect

    init(cells: [GeohashScore]) {
        self.cells = cells
        let rect = Self.computeBoundingRect(for: cells)
        self.boundingMapRect = rect
        self.coordinate = rect.isNull
            ? CLLocationCoordinate2D(latitude: 0, longitude: 0)
            : MKMapPoint(x: rect.midX, y: rect.midY).coordinate
        super.init()
    }

    private static func computeBoundingRect(for cells: [GeohashScore]) -> MKMapRect {
        var rect = MKMapRect.null
        for cell in cells {
            guard let ring = try? GeohashGeometry.polygonRing(for: cell.cellId) else { continue }
            for corner in ring {
                let mapPoint = MKMapPoint(CLLocationCoordinate2D(latitude: corner.latitude, longitude: corner.longitude))
                rect = rect.union(MKMapRect(x: mapPoint.x, y: mapPoint.y, width: 0, height: 0))
            }
        }
        return rect
    }
}

/// Draws each cell as a filled, stroked polygon. Fill color encodes
/// `opportunityScore` normalized against the batch's own min/max
/// (`IntensityNormalization`, `ConsoleModels`) along a forest -> gold ->
/// terra gradient — the same three brand semantic colors
/// `ConsolePointAnnotationView`'s pin palette already uses, so "high
/// opportunity" reads as an escalation along a color language the map
/// already teaches, not an arbitrary new heat scale.
final class GeohashGridRenderer: MKOverlayRenderer {
    private let gridOverlay: GeohashGridOverlay
    private let minScore: Double
    private let maxScore: Double

    init(overlay: GeohashGridOverlay) {
        self.gridOverlay = overlay
        let scores = overlay.cells.map(\.opportunityScore)
        self.minScore = scores.min() ?? 0
        self.maxScore = scores.max() ?? 0
        super.init(overlay: overlay)
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        for cell in gridOverlay.cells {
            guard let ring = try? GeohashGeometry.polygonRing(for: cell.cellId), ring.count >= 4 else { continue }

            let path = CGMutablePath()
            for (index, corner) in ring.enumerated() {
                let mapPoint = MKMapPoint(CLLocationCoordinate2D(latitude: corner.latitude, longitude: corner.longitude))
                let cgPoint = point(for: mapPoint)
                if index == 0 {
                    path.move(to: cgPoint)
                } else {
                    path.addLine(to: cgPoint)
                }
            }
            path.closeSubpath()

            let normalized = IntensityNormalization.normalize(cell.opportunityScore, minValue: minScore, maxValue: maxScore)

            context.addPath(path)
            context.setFillColor(Self.fillColor(forNormalizedScore: normalized).cgColor)
            context.fillPath()

            context.addPath(path)
            context.setStrokeColor(UIColor.white.withAlphaComponent(0.55).cgColor)
            // Constant ~0.75pt on-screen stroke regardless of zoom level —
            // `lineWidth` is in the CTM's pre-zoomScale user space, so it
            // must be divided by `zoomScale` to stay visually constant
            // (mirrors the idiom below in `HeatMapRenderer`'s doc comment).
            context.setLineWidth(max(0.75 / zoomScale, 0.5))
            context.strokePath()
        }
    }

    /// Forest (low opportunity) -> gold (mid) -> terra (high opportunity),
    /// interpolated in RGB space.
    private static func fillColor(forNormalizedScore normalized: Double) -> UIColor {
        let clamped = min(max(normalized, 0), 1)
        let low = UIColor(red: 76 / 255, green: 124 / 255, blue: 89 / 255, alpha: 0.42)
        let mid = UIColor(red: 244 / 255, green: 195 / 255, blue: 23 / 255, alpha: 0.5)
        let high = UIColor(red: 200 / 255, green: 107 / 255, blue: 74 / 255, alpha: 0.62)

        if clamped < 0.5 {
            return low.adlInterpolated(to: mid, fraction: clamped / 0.5)
        } else {
            return mid.adlInterpolated(to: high, fraction: (clamped - 0.5) / 0.5)
        }
    }
}

extension UIColor {
    /// Linear RGBA interpolation toward `other`, `fraction` clamped to
    /// `0...1`. Shared by `GeohashGridRenderer` and `HeatMapRenderer`.
    func adlInterpolated(to other: UIColor, fraction: Double) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = CGFloat(min(max(fraction, 0), 1))
        return UIColor(
            red: r1 + (r2 - r1) * t,
            green: g1 + (g2 - g1) * t,
            blue: b1 + (b2 - b1) * t,
            alpha: a1 + (a2 - a1) * t
        )
    }
}
