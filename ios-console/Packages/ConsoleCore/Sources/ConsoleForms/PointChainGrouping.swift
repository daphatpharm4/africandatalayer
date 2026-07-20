import ConsoleModels
import Foundation

/// One point-chain (a root record plus any enrichments that share its
/// `pointId`), collapsed to a single representative for map/list display.
///
/// Modeling note: the TS source (`CollapsedPlatformPoint` in
/// `lib/client/platformPointUi.ts`) returns `PlatformRecord & { chainCount,
/// chain }` with the aggregated `photos` spliced into
/// `representative.evidence.photos` (`{ ...base, evidence: { ...base.evidence,
/// photos } }`). This port keeps `representative` as the untouched newest
/// `PlatformRecord` and exposes `photos` as its own top-level field instead of
/// mutating a copy of `evidence` — same aggregated data, a plainer Swift
/// shape (per the task brief's suggested API), and it avoids readers
/// mistakenly treating `representative.evidence.photos` as chain-aggregated
/// when it is not.
public struct CollapsedPlatformPoint: Equatable, Sendable, Identifiable {
    /// The newest record in the chain (by `createdAt`) — latest state wins,
    /// same as the TS `base`.
    public var representative: PlatformRecord
    /// Every record in the chain, newest first — one entry per survey/update.
    /// Powers the per-update history sections on the point detail.
    public var chain: [PlatformRecord]
    /// How many surveys/updates this point has.
    public var chainCount: Int
    /// Photos aggregated across the whole chain, newest-record-first, deduped.
    public var photos: [String]

    public init(representative: PlatformRecord, chain: [PlatformRecord], chainCount: Int, photos: [String]) {
        self.representative = representative
        self.chain = chain
        self.chainCount = chainCount
        self.photos = photos
    }

    /// The chain's root id — `representative.pointId ?? representative.id`,
    /// the same value every record in the chain shares as its grouping key
    /// in `PointChainGrouping.collapseRecordChains`. A fresh capture meant to
    /// join this point (rather than start a new one) should set its own
    /// `PlatformRecord.pointId` to this value. Also doubles as `Identifiable`
    /// conformance's `id` — stable across a reload even when the newest
    /// (representative) record changes.
    public var id: String { rootId }

    public var rootId: String {
        representative.pointId ?? representative.id
    }
}

/// Direct port of `collapseRecordChains` in `lib/client/platformPointUi.ts`.
public enum PointChainGrouping {
    /// Collapse a flat list of approved platform records into ONE
    /// representative record per point-chain, mirroring the server's
    /// group-by-root (`lib/server/platform/pointLookup.ts`). A record with no
    /// `pointId` is a chain root (root = its own id); enrichments carry
    /// `pointId = root`. Without this the company map renders one pin PER
    /// record, so every update of an asset drops a duplicate pin instead of
    /// appending to the same point.
    ///
    /// Group order in the result follows first-appearance order of each root
    /// in `records` (matches JS `Map` iteration order, which TS relies on
    /// implicitly since it never re-sorts `groups.values()`).
    public static func collapseRecordChains(_ records: [PlatformRecord]) -> [CollapsedPlatformPoint] {
        var groupsByRoot: [String: [PlatformRecord]] = [:]
        var rootsInOrder: [String] = []

        for record in records {
            let root = record.pointId ?? record.id
            if groupsByRoot[root] != nil {
                groupsByRoot[root]?.append(record)
            } else {
                groupsByRoot[root] = [record]
                rootsInOrder.append(root)
            }
        }

        var points: [CollapsedPlatformPoint] = []
        points.reserveCapacity(rootsInOrder.count)

        for root in rootsInOrder {
            guard let group = groupsByRoot[root] else { continue }
            // Swift's `sorted` is a stable sort, matching V8's stable
            // `Array.prototype.sort` — ties keep their original relative order.
            let byNewest = group.sorted { createdAtDate($0) > createdAtDate($1) }
            let representative = byNewest[0]

            var photos: [String] = []
            var seenPhotos: Set<String> = []
            for record in byNewest {
                for photo in record.evidence.photos where !seenPhotos.contains(photo) {
                    seenPhotos.insert(photo)
                    photos.append(photo)
                }
            }

            points.append(
                CollapsedPlatformPoint(
                    representative: representative,
                    chain: byNewest,
                    chainCount: group.count,
                    photos: photos
                )
            )
        }

        return points
    }

    private static func createdAtDate(_ record: PlatformRecord) -> Date {
        parseISO8601(record.createdAt) ?? .distantPast
    }
}

/// Tolerant ISO-8601 parse (with or without fractional seconds) — mirrors
/// `new Date(record.createdAt).getTime()`'s permissiveness closely enough for
/// the API's own timestamp format.
private func parseISO8601(_ value: String) -> Date? {
    if let date = ISO8601Formatters.fractionalSeconds.date(from: value) {
        return date
    }
    return ISO8601Formatters.plain.date(from: value)
}

/// `ISO8601DateFormatter` is not `Sendable`, but these instances are only
/// ever read (never mutated) after creation, so sharing them across
/// concurrent callers is safe — same reasoning as
/// `DataBrowseView.ISO8601DateFormatter.parsingFractionalSecondsData`.
private enum ISO8601Formatters {
    nonisolated(unsafe) static let fractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) static let plain = ISO8601DateFormatter()
}
