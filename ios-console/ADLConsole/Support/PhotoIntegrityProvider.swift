import CoreGraphics
import CryptoKit
import Foundation
import ImageIO

/// Seam between the capture flow's photo-evidence step and ImageIO/CryptoKit
/// — mirrors the injectable `LocationServiceProtocol` / `CoreLocationService`
/// pattern used elsewhere in this app so photo-integrity checks (EXIF
/// presence, content hashing) can be tested without real camera output.
protocol PhotoIntegrityProviding: Sendable {
    /// Extracts EXIF/TIFF/GPS metadata from raw image bytes via
    /// `CGImageSource`. The TIFF, Exif, and GPS sub-dictionaries are
    /// flattened into the top-level result (e.g. `"Make"`, `"Model"`,
    /// `kCGImagePropertyExifDateTimeOriginal`) so callers don't need to know
    /// ImageIO's nested dictionary layout. Returns an empty dictionary when
    /// `photoData` isn't a decodable image or carries no metadata.
    func extractExif(from photoData: Data) -> [String: Any]

    /// Lowercase hex SHA-256 digest of `photoData`, matching the checksum
    /// format `CaptureMediaStore` uses for attachment integrity.
    func sha256Hash(of photoData: Data) -> String
}

/// Production `PhotoIntegrityProviding` backed by `CGImageSource` (ImageIO)
/// for EXIF extraction and `CryptoKit.SHA256` for hashing — the same
/// digest computation `CaptureMediaStore`/`CaptureMediaPreparer` already use
/// for attachment checksums, applied here to raw capture bytes.
final class CoreImagePhotoIntegrityProvider: PhotoIntegrityProviding {
    func extractExif(from photoData: Data) -> [String: Any] {
        guard let source = CGImageSourceCreateWithData(photoData as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] else {
            return [:]
        }

        var flattened = properties
        if let exif = properties[kCGImagePropertyExifDictionary as String] as? [String: Any] {
            flattened.merge(exif) { _, new in new }
        }
        if let tiff = properties[kCGImagePropertyTIFFDictionary as String] as? [String: Any] {
            flattened.merge(tiff) { _, new in new }
        }
        if let gps = properties[kCGImagePropertyGPSDictionary as String] as? [String: Any] {
            flattened.merge(gps) { _, new in new }
        }
        return flattened
    }

    func sha256Hash(of photoData: Data) -> String {
        SHA256.hash(data: photoData).compactMap { String(format: "%02x", $0) }.joined()
    }
}
