import XCTest
@testable import ConsoleModels

final class JSONValueTests: XCTestCase {
    func testRoundTripAllCases() throws {
        let value: JSONValue = .object([
            "str": .string("hello"),
            "num": .number(42.5),
            "bool": .bool(true),
            "null": .null,
            "arr": .array([.string("a"), .number(1), .bool(false)])
        ])
        let data = try JSONEncoder().encode(value)
        let decoded = try JSONDecoder().decode(JSONValue.self, from: data)
        XCTAssertEqual(decoded, value)
    }

    func testDecodesFromRawJSON() throws {
        let json = """
        {"name":"Acme","count":3,"active":true,"tags":["a","b"],"note":null}
        """
        let data = json.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(JSONValue.self, from: data)
        guard case .object(let dict) = decoded else {
            return XCTFail("expected object")
        }
        XCTAssertEqual(dict["name"], .string("Acme"))
        XCTAssertEqual(dict["count"], .number(3))
        XCTAssertEqual(dict["active"], .bool(true))
        XCTAssertEqual(dict["tags"], .array([.string("a"), .string("b")]))
        XCTAssertEqual(dict["note"], .null)
    }

    func testDictionaryOfJSONValueRoundTrips() throws {
        let dict: [String: JSONValue] = [
            "outletType": .string("pharmacy"),
            "queueLength": .number(2)
        ]
        let data = try JSONEncoder().encode(dict)
        let decoded = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(decoded, dict)
    }
}
