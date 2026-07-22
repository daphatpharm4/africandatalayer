import SwiftUI
import UIKit

struct CameraCaptureView: UIViewControllerRepresentable {
    let onCapture: (Result<String, CameraCaptureError>) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera)
            ? .camera
            : .photoLibrary
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraCaptureView

        init(_ parent: CameraCaptureView) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            guard let image = info[.originalImage] as? UIImage else {
                parent.onCapture(.failure(.invalidImage))
                parent.dismiss()
                return
            }

            do {
                let dataURL = try PlatformPhotoPreparer.dataURL(from: image)
                parent.onCapture(.success(dataURL))
            } catch let error as CameraCaptureError {
                parent.onCapture(.failure(error))
            } catch {
                parent.onCapture(.failure(.tooLarge))
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

enum CameraCaptureError: Error, Equatable {
    case invalidImage
    case tooLarge
}

private enum PlatformPhotoPreparer {
    private static let maxDataURLLength = 300_000
    private static let maxDimension: CGFloat = 1_280
    private static let minDimension: CGFloat = 480

    static func dataURL(from image: UIImage) throws -> String {
        let originalSize = normalizedSize(for: image)
        let longestSide = max(originalSize.width, originalSize.height)
        guard longestSide > 0 else { throw CameraCaptureError.invalidImage }

        var scale = min(1, maxDimension / longestSide)
        var quality: CGFloat = 0.76

        while scale * longestSide >= minDimension {
            let targetSize = CGSize(
                width: max(1, (originalSize.width * scale).rounded()),
                height: max(1, (originalSize.height * scale).rounded())
            )
            let rendered = render(image, at: targetSize)
            guard let data = rendered.jpegData(compressionQuality: quality) else {
                throw CameraCaptureError.invalidImage
            }

            let dataURL = "data:image/jpeg;base64,\(data.base64EncodedString())"
            if dataURL.count <= maxDataURLLength {
                return dataURL
            }

            if quality > 0.48 {
                quality = max(0.48, quality - 0.08)
            } else {
                scale *= 0.82
            }
        }

        throw CameraCaptureError.tooLarge
    }

    private static func normalizedSize(for image: UIImage) -> CGSize {
        switch image.imageOrientation {
        case .left, .leftMirrored, .right, .rightMirrored:
            CGSize(width: image.size.height, height: image.size.width)
        default:
            image.size
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
