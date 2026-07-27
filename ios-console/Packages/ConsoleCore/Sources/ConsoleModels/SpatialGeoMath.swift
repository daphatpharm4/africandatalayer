import Foundation

// MARK: - Geohash bounding-box decode (for the map's "Grid" overlay)
//
// `GeohashScore.cellId` (see `PlatformAnalytics.swift`) IS a geohash string
// — the server always encodes cells at precision 6
// (`lib/server/spatialIntelligence.ts` -> `encodeGeohash(latitude,
// longitude, 6)`, `lib/shared/pointId.ts`). This is a Swift port of that
// same file's `decodeGeohashBounds`, algorithm-for-algorithm (bit
// interleaving, longitude bits on even steps), so a cell's polygon corners
// come straight from its `cellId` with no extra size parameter needed.

/// A geohash cell's lat/lon bounding box, in degrees.
public struct GeoBounds: Equatable, Sendable {
    public let south: Double
    public let west: Double
    public let north: Double
    public let east: Double

    public init(south: Double, west: Double, north: Double, east: Double) {
        self.south = south
        self.west = west
        self.north = north
        self.east = east
    }
}

public enum GeohashDecodeError: Error, Equatable, Sendable {
    case empty
    case invalidCharacter(Character)
}

public enum GeohashGeometry {
    private static let base32Alphabet = "0123456789bcdefghjkmnpqrstuvwxyz"
    private static let base32Index: [Character: Int] = {
        var map: [Character: Int] = [:]
        for (index, character) in base32Alphabet.enumerated() {
            map[character] = index
        }
        return map
    }()

    /// Port of `decodeGeohashBounds` (`lib/shared/pointId.ts`). Throws
    /// `.empty` for a blank/whitespace-only string and `.invalidCharacter`
    /// for the first character outside the geohash base32 alphabet — the JS
    /// original throws a single generic error for both; this keeps them
    /// distinct since callers here (renderers, tap-hit-testing) may want to
    /// tell "no cell" apart from "malformed server data".
    public static func decodeBounds(_ geohash: String) throws -> GeoBounds {
        let normalized = geohash.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { throw GeohashDecodeError.empty }

        var latMin = -90.0
        var latMax = 90.0
        var lonMin = -180.0
        var lonMax = 180.0
        var isEvenBit = true

        for character in normalized {
            guard let digit = base32Index[character] else {
                throw GeohashDecodeError.invalidCharacter(character)
            }
            var mask = 16
            while mask > 0 {
                if isEvenBit {
                    let midpoint = (lonMin + lonMax) / 2
                    if digit & mask != 0 { lonMin = midpoint } else { lonMax = midpoint }
                } else {
                    let midpoint = (latMin + latMax) / 2
                    if digit & mask != 0 { latMin = midpoint } else { latMax = midpoint }
                }
                isEvenBit.toggle()
                mask >>= 1
            }
        }

        return GeoBounds(south: latMin, west: lonMin, north: latMax, east: lonMax)
    }

    /// A closed polygon ring (5 points, first == last) for a geohash cell's
    /// bounding box, ordered SW -> NW -> NE -> SE -> SW — ready to hand to
    /// `MKPolygon(coordinates:count:)` for the grid overlay.
    public static func polygonRing(for geohash: String) throws -> [(latitude: Double, longitude: Double)] {
        let bounds = try decodeBounds(geohash)
        return [
            (bounds.south, bounds.west),
            (bounds.north, bounds.west),
            (bounds.north, bounds.east),
            (bounds.south, bounds.east),
            (bounds.south, bounds.west)
        ]
    }
}

// MARK: - Intensity normalization (for the map's "Heat" overlay)

/// Linear min/max normalization into `0...1`, used to turn a batch of
/// `GeohashScore.opportunityScore` / `HeatMapCell.intensity` values into a
/// fill alpha, gradient stop, or radius scale that's legible regardless of
/// the absolute score range for the currently loaded vertical/cell set.
public enum IntensityNormalization {
    /// Clamps `value` into `[minValue, maxValue]` then normalizes to
    /// `0...1`. When the range is degenerate (`maxValue <= minValue` — e.g.
    /// a single-cell dataset, or every cell tied at the same score), every
    /// value maps to `1.0` rather than `0` or `NaN`, so the data still
    /// renders at full intensity instead of disappearing.
    public static func normalize(_ value: Double, minValue: Double, maxValue: Double) -> Double {
        guard maxValue > minValue else { return 1.0 }
        let clamped = min(max(value, minValue), maxValue)
        return (clamped - minValue) / (maxValue - minValue)
    }

    /// Normalizes a whole set against its own min/max, preserving order and
    /// count. Empty input yields empty output; a single value normalizes to
    /// `1.0` (degenerate range, see above).
    public static func normalize(_ values: [Double]) -> [Double] {
        guard let minValue = values.min(), let maxValue = values.max() else { return [] }
        return values.map { normalize($0, minValue: minValue, maxValue: maxValue) }
    }
}
