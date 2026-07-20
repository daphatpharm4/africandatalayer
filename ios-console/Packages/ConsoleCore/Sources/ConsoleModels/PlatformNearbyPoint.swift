import Foundation

/// Mirrors `PlatformNearbyPoint` in `shared/platformTypes.ts`.
///
/// Modeling notes (ambiguous / out-of-scope TS references):
/// - `details: SubmissionDetails` — `SubmissionDetails` is a large interface
///   defined in `shared/types.ts` (60+ optional fields plus a
///   `[key: string]: unknown` index signature and several external
///   sub-types), imported into `platformTypes.ts` rather than declared there.
///   Porting it in full is out of scope for this port of
///   `shared/platformTypes.ts`'s own exports, and its index signature makes it
///   effectively open-ended JSON anyway. Modeled as `[String: JSONValue]`.
/// - `operatorSignals?: Record<string, PointOperatorSignalState>` —
///   `PointOperatorSignalState` is likewise defined in `shared/types.ts`, not
///   exported by `platformTypes.ts`. Modeled as `[String: JSONValue]` for the
///   same reason.
public struct PlatformNearbyPoint: Codable, Equatable, Sendable {
    /// Mirrors the anonymous `location: { latitude: number; longitude: number }`
    /// object type nested in `PlatformNearbyPoint`.
    public struct Location: Codable, Equatable, Sendable {
        public var latitude: Double
        public var longitude: Double

        public init(latitude: Double, longitude: Double) {
            self.latitude = latitude
            self.longitude = longitude
        }
    }

    public var pointId: String
    public var category: String
    public var name: String?
    public var location: Location
    public var details: [String: JSONValue]
    public var photoUrl: String?
    public var createdAt: String
    public var updatedAt: String
    public var gaps: [String]
    /// Modeling note: TS `eventsCount: number` — represented as `Int` since
    /// it is a count.
    public var eventsCount: Int
    public var operatorSignals: [String: JSONValue]?
    /// Modeling note: TS `distanceMeters: number` — represented as `Double`
    /// since geographic distances are not integer-constrained.
    public var distanceMeters: Double

    public init(
        pointId: String,
        category: String,
        name: String?,
        location: Location,
        details: [String: JSONValue],
        photoUrl: String? = nil,
        createdAt: String,
        updatedAt: String,
        gaps: [String],
        eventsCount: Int,
        operatorSignals: [String: JSONValue]? = nil,
        distanceMeters: Double
    ) {
        self.pointId = pointId
        self.category = category
        self.name = name
        self.location = location
        self.details = details
        self.photoUrl = photoUrl
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.gaps = gaps
        self.eventsCount = eventsCount
        self.operatorSignals = operatorSignals
        self.distanceMeters = distanceMeters
    }
}
