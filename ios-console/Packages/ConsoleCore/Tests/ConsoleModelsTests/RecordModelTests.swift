import XCTest
@testable import ConsoleModels

final class RecordModelTests: XCTestCase {
    func testPlatformRecordGpsRoundTrip() throws {
        let gps = PlatformRecordGps(latitude: 4.05, longitude: 9.71, accuracyMeters: 12.5)
        let data = try JSONEncoder().encode(gps)
        let decoded = try JSONDecoder().decode(PlatformRecordGps.self, from: data)
        XCTAssertEqual(decoded, gps)
    }

    func testPlatformRecordGpsDecodesFromFixtureMissingAccuracy() throws {
        let json = """
        {"latitude":4.05,"longitude":9.71}
        """
        let decoded = try JSONDecoder().decode(PlatformRecordGps.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.latitude, 4.05)
        XCTAssertNil(decoded.accuracyMeters)
    }

    func testPlatformRecordEvidenceRoundTripFullyPopulated() throws {
        let evidence = PlatformRecordEvidence(
            gps: PlatformRecordGps(latitude: 4.05, longitude: 9.71, accuracyMeters: nil),
            photos: ["https://example.com/a.jpg"],
            notes: "Looks good",
            capturedAt: "2026-01-01T00:00:00.000Z",
            device: PlatformRecordEvidence.Device(deviceId: "device-1", platform: "android", userAgent: "Mozilla/5.0", language: "fr"),
            photoMetadata: [
                PlatformRecordEvidence.PhotoMetadata(
                    mimeType: "image/jpeg",
                    originalBytes: 204800,
                    storedBytes: 102400,
                    width: 1080,
                    height: 1920,
                    capturedAt: "2026-01-01T00:00:00.000Z"
                )
            ],
            clientExif: PlatformRecordEvidence.ClientExif(
                latitude: 4.05,
                longitude: 9.71,
                capturedAt: "2026-01-01T00:00:00.000Z",
                deviceMake: "Apple",
                deviceModel: "iPhone"
            ),
            gpsIntegrity: PlatformRecordEvidence.GpsIntegrity(
                mockLocationDetected: false,
                mockLocationMethod: nil,
                hasAccelerometerData: true,
                hasGyroscopeData: true,
                accelerometerSampleCount: 12,
                motionDetectedDuringCapture: true,
                gpsAccuracyMeters: 10,
                networkType: nil,
                gpsTimestamp: 1_767_225_600_000,
                deviceTimestamp: 1_767_225_600_050,
                timeDeltaMs: 50
            )
        )
        let data = try JSONEncoder().encode(evidence)
        let decoded = try JSONDecoder().decode(PlatformRecordEvidence.self, from: data)
        XCTAssertEqual(decoded, evidence)
        let raw = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let gpsIntegrity = try XCTUnwrap(raw["gpsIntegrity"] as? [String: Any])
        XCTAssertTrue(gpsIntegrity.keys.contains("mockLocationMethod"))
        XCTAssertTrue(gpsIntegrity.keys.contains("networkType"))
    }

    func testPlatformRecordEvidenceDecodesFromMinimalFixture() throws {
        let json = """
        {"photos":[]}
        """
        let decoded = try JSONDecoder().decode(PlatformRecordEvidence.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.photos, [])
        XCTAssertNil(decoded.gps)
        XCTAssertNil(decoded.notes)
        XCTAssertNil(decoded.device)
        XCTAssertNil(decoded.photoMetadata)
        XCTAssertNil(decoded.clientExif)
        XCTAssertNil(decoded.gpsIntegrity)
    }

    func testPlatformRecordRoundTripAndFixture() throws {
        let record = PlatformRecord(
            id: "rec_1",
            projectId: "proj_1",
            organizationId: "org_1",
            schemaVersionId: "schema_1",
            recordTypeKey: "pharmacy",
            data: ["name": .string("Pharmacie Centrale"), "isOpenNow": .bool(true)],
            evidence: PlatformRecordEvidence(
                gps: PlatformRecordGps(latitude: 4.05, longitude: 9.71, accuracyMeters: 10),
                photos: ["https://example.com/a.jpg"],
                notes: nil,
                capturedAt: nil,
                device: nil,
                photoMetadata: nil
            ),
            status: .pendingReview,
            capturedBy: "user_1",
            createdAt: "2026-01-01T00:00:00.000Z",
            pointId: nil,
            reviewedBy: nil,
            reviewedAt: nil,
            reviewNotes: nil
        )
        let data = try JSONEncoder().encode(record)
        let decoded = try JSONDecoder().decode(PlatformRecord.self, from: data)
        XCTAssertEqual(decoded, record)

        let json = """
        {
          "id": "rec_1",
          "projectId": "proj_1",
          "organizationId": "org_1",
          "schemaVersionId": "schema_1",
          "recordTypeKey": "pharmacy",
          "data": {"name": "Pharmacie Centrale", "isOpenNow": true},
          "evidence": {"photos": ["https://example.com/a.jpg"]},
          "status": "approved",
          "capturedBy": "user_1",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "pointId": "point_1",
          "reviewedBy": "admin_1",
          "reviewedAt": "2026-01-02T00:00:00.000Z",
          "reviewNotes": "Verified on site"
        }
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformRecord.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.status, .approved)
        XCTAssertEqual(fixtureDecoded.data["name"], .string("Pharmacie Centrale"))
        XCTAssertEqual(fixtureDecoded.data["isOpenNow"], .bool(true))
        XCTAssertEqual(fixtureDecoded.pointId, "point_1")
        XCTAssertEqual(fixtureDecoded.reviewNotes, "Verified on site")
    }

    func testPlatformRecordSummaryRoundTrip() throws {
        let summary = PlatformRecordSummary(
            total: 100,
            pendingReview: 10,
            approved: 85,
            rejected: 5,
            submittedToday: 4
        )
        let data = try JSONEncoder().encode(summary)
        let decoded = try JSONDecoder().decode(PlatformRecordSummary.self, from: data)
        XCTAssertEqual(decoded, summary)
    }
}
