import CryptoKit
import Foundation
import UIKit

enum CaptureMediaPreparerError: Error, Equatable {
    case invalidImage
    case tooLarge
}

struct CaptureMediaPreparer {
    private static let maxDataURLLength = 300_000
    private static let maxDimension: CGFloat = 1_280
    private static let minDimension: CGFloat = 480
    private static let initialQuality: CGFloat = 0.76
    private static let qualityFloor: CGFloat = 0.48
    private static let qualityStep: CGFloat = 0.04

    static func prepare(_ image: UIImage) throws -> PreparedCaptureMedia {
        let normalized = normalizedImage(image)
        let originalSize = normalized.size
        let longestSide = max(originalSize.width, originalSize.height)
        guard longestSide > 0 else { throw CaptureMediaPreparerError.invalidImage }

        var scale = min(1, Self.maxDimension / longestSide)
        var quality = Self.initialQuality

        while scale * longestSide >= Self.minDimension {
            let targetSize = CGSize(
                width: max(1, (originalSize.width * scale).rounded()),
                height: max(1, (originalSize.height * scale).rounded())
            )
            let rendered = render(normalized, at: targetSize)
            guard let data = rendered.jpegData(compressionQuality: quality) else {
                throw CaptureMediaPreparerError.invalidImage
            }

            let dataURL = "data:image/jpeg;base64,\(data.base64EncodedString())"
            if dataURL.count <= Self.maxDataURLLength {
                let sha256 = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
                return PreparedCaptureMedia(
                    data: data,
                    mimeType: "image/jpeg",
                    sha256: sha256,
                    pixelWidth: Int(targetSize.width),
                    pixelHeight: Int(targetSize.height)
                )
            }

            if quality > Self.qualityFloor {
                quality = max(Self.qualityFloor, quality - Self.qualityStep)
            } else {
                scale *= 0.82
            }
        }

        throw CaptureMediaPreparerError.tooLarge
    }

    private static func normalizedImage(_ image: UIImage) -> UIImage {
        guard image.imageOrientation != .up else { return image }
        return UIGraphicsImageRenderer(size: image.size, format: {
            let fmt = UIGraphicsImageRendererFormat.default()
            fmt.opaque = true
            fmt.scale = 1
            return fmt
        }()).image { context in
            context.cgContext.translateBy(x: 0, y: image.size.height)
            context.cgContext.scaleBy(x: 1, y: -1)
            let rect = CGRect(origin: .zero, size: image.size)
            switch image.imageOrientation {
            case .left, .leftMirrored:
                context.cgContext.rotate(by: -(.pi / 2))
                image.draw(at: CGPoint(x: -image.size.width, y: 0))
            case .right, .rightMirrored:
                context.cgContext.rotate(by: .pi / 2)
                image.draw(at: CGPoint(x: 0, y: -image.size.height))
            case .down, .downMirrored:
                context.cgContext.rotate(by: .pi)
                image.draw(at: CGPoint(x: -image.size.width, y: -image.size.height))
            default:
                image.draw(in: rect)
            }
        }
    }

    private static func render(_ image: UIImage, at size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
