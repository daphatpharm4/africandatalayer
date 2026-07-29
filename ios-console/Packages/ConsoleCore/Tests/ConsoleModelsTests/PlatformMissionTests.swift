import Foundation
import XCTest
@testable import ConsoleModels

final class PlatformMissionTests: XCTestCase {
    func testMissionDecodingAndProgressClamping() throws {
        let data = Data("""
        {
          "id":"mission-1","organizationId":"org-1","period":"daily","state":"in_progress",
          "titleEn":"Verify 5 shops","titleFr":"Vérifier 5 commerces","quota":5,"current":3,
          "rewardXp":10,"deadline":"2026-07-30T00:00:00Z","projectId":null,"category":null,
          "notesEn":null,"notesFr":null,"assignedUserIds":["user-1"],
          "createdAt":"2026-07-29T00:00:00Z","updatedAt":"2026-07-29T01:00:00Z"
        }
        """.utf8)

        let mission = try JSONDecoder().decode(PlatformMission.self, from: data)

        XCTAssertEqual(mission.period, .daily)
        XCTAssertEqual(mission.state, .inProgress)
        XCTAssertEqual(mission.progressFraction, 0.6, accuracy: 0.001)
        XCTAssertEqual(mission.title(language: "fr"), "Vérifier 5 commerces")
    }

    func testCreateInputUsesBackendContractNames() throws {
        let input = PlatformMissionCreateInput(
            organizationId: "org-1",
            titleEn: "Weekly verification",
            titleFr: "Vérification hebdomadaire",
            quota: 10,
            deadline: "2026-08-05T00:00:00Z",
            rewardXp: 20,
            targetUserIds: ["user-1"]
        )
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any]
        )

        XCTAssertEqual(object["organizationId"] as? String, "org-1")
        XCTAssertEqual(object["titleFr"] as? String, "Vérification hebdomadaire")
        XCTAssertEqual(object["targetUserIds"] as? [String], ["user-1"])
    }
}
