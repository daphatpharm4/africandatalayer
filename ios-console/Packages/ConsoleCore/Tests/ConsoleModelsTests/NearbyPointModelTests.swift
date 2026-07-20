import XCTest
@testable import ConsoleModels

final class NearbyPointModelTests: XCTestCase {
    func testPlatformNearbyPointRoundTripFullyPopulated() throws {
        let point = PlatformNearbyPoint(
            pointId: "point_1",
            category: "pharmacy",
            name: "Pharmacie Centrale",
            location: PlatformNearbyPoint.Location(latitude: 4.05, longitude: 9.71),
            details: ["isOpenNow": .bool(true), "name": .string("Pharmacie Centrale")],
            photoUrl: "https://example.com/a.jpg",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            gaps: ["photo", "gps"],
            eventsCount: 3,
            operatorSignals: ["isOpenNow": .object(["value": .bool(true)])],
            distanceMeters: 42.5
        )
        let data = try JSONEncoder().encode(point)
        let decoded = try JSONDecoder().decode(PlatformNearbyPoint.self, from: data)
        XCTAssertEqual(decoded, point)
    }

    func testPlatformNearbyPointDecodesFromFixtureMissingOptionalKeys() throws {
        let json = """
        {
          "pointId": "point_2",
          "category": "fuel_station",
          "name": null,
          "location": {"latitude": 4.06, "longitude": 9.72},
          "details": {},
          "createdAt": "2026-01-01T00:00:00.000Z",
          "updatedAt": "2026-01-02T00:00:00.000Z",
          "gaps": [],
          "eventsCount": 1,
          "distanceMeters": 10.2
        }
        """
        let decoded = try JSONDecoder().decode(PlatformNearbyPoint.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.pointId, "point_2")
        XCTAssertNil(decoded.name)
        XCTAssertEqual(decoded.location.latitude, 4.06)
        XCTAssertNil(decoded.photoUrl)
        XCTAssertNil(decoded.operatorSignals)
        XCTAssertEqual(decoded.distanceMeters, 10.2)
    }
}
