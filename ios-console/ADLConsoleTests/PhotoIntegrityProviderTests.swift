@testable import ADLConsole
import XCTest

/// Coverage for `PhotoIntegrityProviding` / `CoreImagePhotoIntegrityProvider`:
/// EXIF extraction via `CGImageSource` (present-metadata vs stripped-image
/// cases) and SHA-256 hashing (determinism + differentiation), mirroring the
/// hashing already exercised by `CaptureMediaStoreTests`.
final class PhotoIntegrityProviderTests: XCTestCase {
    func testExtractExifReturnsKnownKeys() throws {
        let provider = CoreImagePhotoIntegrityProvider()
        let testJPEG = try XCTUnwrap(testImageData())
        let exif = provider.extractExif(from: testJPEG)
        XCTAssertNotNil(exif["Make"])
        XCTAssertNotNil(exif["Model"])
        XCTAssertNotNil(exif[kCGImagePropertyExifDateTimeOriginal as String])
    }

    func testExtractExifReturnsNilForStrippedImage() {
        let provider = CoreImagePhotoIntegrityProvider()
        let stripped = Data("not an image".utf8)
        let exif = provider.extractExif(from: stripped)
        XCTAssertTrue(exif.isEmpty)
    }

    func testSha256HashReturnsConsistentValue() {
        let provider = CoreImagePhotoIntegrityProvider()
        let data = Data("hello".utf8)
        let hash1 = provider.sha256Hash(of: data)
        let hash2 = provider.sha256Hash(of: data)
        XCTAssertEqual(hash1, hash2)
        XCTAssertEqual(hash1.count, 64)
    }

    func testSha256HashDiffersForDifferentData() {
        let provider = CoreImagePhotoIntegrityProvider()
        let hash1 = provider.sha256Hash(of: Data("hello".utf8))
        let hash2 = provider.sha256Hash(of: Data("world".utf8))
        XCTAssertNotEqual(hash1, hash2)
    }

    /// Creates a minimal JPEG with EXIF metadata for testing.
    private func testImageData() -> Data? {
        // Build minimal JPEG with EXIF via CGImageDestination
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let context = CGContext(
            data: nil,
            width: 2,
            height: 2,
            bitsPerComponent: 8,
            bytesPerRow: 8,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )
        guard let cgImage = context?.makeImage() else { return nil }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil) else {
            return nil
        }
        let exif: [CFString: Any] = [
            kCGImagePropertyExifDictionary: [
                kCGImagePropertyExifDateTimeOriginal: "2026:07:24 10:00:00",
                kCGImagePropertyExifISOSpeedRatings: [100],
                kCGImagePropertyExifFocalLength: 4.25,
            ],
            kCGImagePropertyTIFFDictionary: [
                kCGImagePropertyTIFFMake: "Apple",
                kCGImagePropertyTIFFModel: "iPhone 15,2",
            ],
            kCGImagePropertyGPSDictionary: [
                kCGImagePropertyGPSLatitude: 4.05,
                kCGImagePropertyGPSLongitude: 9.70,
            ],
        ]
        CGImageDestinationAddImage(destination, cgImage, exif as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }
}
