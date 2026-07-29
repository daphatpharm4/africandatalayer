import Foundation

/// Mirrors `DedupCandidate` in `shared/types.ts` — one nearby existing point
/// the duplicate-candidate lookup (`GET
/// api/submissions?view=dedup_candidates`, `lib/server/dedup.ts`) considers a
/// possible match for an in-progress capture.
///
/// Modeling note: `category` is TS `SubmissionCategory` (a closed 7-value
/// union) there, but is kept as a plain `String` here — the console operates
/// on schema-driven `PlatformRecordType.key` values, not that fixed set, so
/// there is no matching Swift enum to decode into.
public struct DedupCandidate: Decodable, Equatable, Sendable, Identifiable {
    public var id: String { pointId }

    public var pointId: String
    public var category: String
    public var siteName: String?
    public var latitude: Double
    public var longitude: Double
    public var distanceMeters: Double
    public var similarityScore: Double
    public var matchScore: Double

    public init(
        pointId: String,
        category: String,
        siteName: String?,
        latitude: Double,
        longitude: Double,
        distanceMeters: Double,
        similarityScore: Double,
        matchScore: Double
    ) {
        self.pointId = pointId
        self.category = category
        self.siteName = siteName
        self.latitude = latitude
        self.longitude = longitude
        self.distanceMeters = distanceMeters
        self.similarityScore = similarityScore
        self.matchScore = matchScore
    }
}

/// Mirrors `DedupCheckResult` in `shared/types.ts` — the full response body
/// of `GET api/submissions?view=dedup_candidates`.
public struct DedupCheckResult: Decodable, Equatable, Sendable {
    public var shouldPrompt: Bool
    public var radiusMeters: Double
    public var bestCandidatePointId: String?
    public var candidates: [DedupCandidate]

    public init(
        shouldPrompt: Bool,
        radiusMeters: Double,
        bestCandidatePointId: String?,
        candidates: [DedupCandidate]
    ) {
        self.shouldPrompt = shouldPrompt
        self.radiusMeters = radiusMeters
        self.bestCandidatePointId = bestCandidatePointId
        self.candidates = candidates
    }
}
