@testable import ADLConsole
import CryptoKit
import XCTest

final class CaptureMediaPreparerTests: XCTestCase {
    private func makeTestImage(width: Int = 200, height: Int = 200, color: UIColor = .red) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { context in
            color.setFill()
            context.fill(CGRect(origin: .zero, size: CGSize(width: width, height: height)))
        }
    }

    // MARK: - Prepare honors payload limit

    func testPrepareSmallImageReturnsValidPreparedMedia() throws {
        let image = makeTestImage(width: 100, height: 100)
        let prepared = try CaptureMediaPreparer.prepare(image)

        XCTAssertFalse(prepared.data.isEmpty)
        XCTAssertEqual(prepared.mimeType, "image/jpeg")
        XCTAssertFalse(prepared.sha256.isEmpty)
        XCTAssertGreaterThan(prepared.pixelWidth, 0)
        XCTAssertGreaterThan(prepared.pixelHeight, 0)
    }

    func testPrepareFitsWithinDataURLLimit() throws {
        let image = makeTestImage(width: 1920, height: 1080)
        let prepared = try CaptureMediaPreparer.prepare(image)

        let dataURLPrefix = "data:image/jpeg;base64,"
        let dataURL = dataURLPrefix + prepared.data.base64EncodedString()
        XCTAssertLessThanOrEqual(dataURL.count, 300_000)
    }

    func testPrepareResizesLargeImage() throws {
        let image = makeTestImage(width: 4000, height: 3000)
        let prepared = try CaptureMediaPreparer.prepare(image)

        XCTAssertLessThanOrEqual(prepared.pixelWidth, 1280)
        XCTAssertLessThanOrEqual(prepared.pixelHeight, 1280)
    }

    func testPrepareMaintainsAspectRatio() throws {
        let image = makeTestImage(width: 800, height: 600)
        let prepared = try CaptureMediaPreparer.prepare(image)

        let expectedWidth = Int((600.0 / 800.0 * Double(prepared.pixelWidth)).rounded())
        let actualRatio = Double(prepared.pixelWidth) / Double(prepared.pixelHeight)
        XCTAssertEqual(actualRatio, 800.0 / 600.0, accuracy: 0.02)
    }

    func testPrepareChecksumIsDeterministic() throws {
        let image = makeTestImage(width: 100, height: 100)
        let first = try CaptureMediaPreparer.prepare(image)
        let second = try CaptureMediaPreparer.prepare(image)

        XCTAssertEqual(first.sha256, second.sha256)
    }

    // MARK: - Checksum verification

    func testPreparedMediaChecksumMatchesData() throws {
        let image = makeTestImage(width: 200, height: 200)
        let prepared = try CaptureMediaPreparer.prepare(image)

        let computed = SHA256.hash(data: prepared.data).compactMap { String(format: "%02x", $0) }.joined()
        XCTAssertEqual(prepared.sha256, computed)
    }

    func testPrepareHonorsQualityFloor() throws {
        let image = makeTestImage(width: 4000, height: 4000)
        let prepared = try CaptureMediaPreparer.prepare(image)

        XCTAssertFalse(prepared.data.isEmpty)
        let dataURLPrefix = "data:image/jpeg;base64,"
        let dataURL = dataURLPrefix + prepared.data.base64EncodedString()
        XCTAssertLessThanOrEqual(dataURL.count, 300_000)
    }

    func testPrepareThrowsForInvalidImage() {
        let emptyImage = UIImage()
        XCTAssertThrowsError(try CaptureMediaPreparer.prepare(emptyImage)) { error in
            XCTAssertEqual(error as? CaptureMediaPreparerError, .invalidImage)
        }
    }
}
