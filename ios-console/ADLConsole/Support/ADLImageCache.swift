import SwiftUI

/// Lightweight in-memory image cache with on-the-fly downsampling.
/// Prevents full-resolution decode for small thumbnails (44×44, 90px, etc.).
///
/// Usage: `ADLImageCache.shared.image(for: url, targetSize: CGSize(width: 90, height: 90))`
/// Returns immediately from cache if available; otherwise downloads, downsamples,
/// stores, and returns asynchronously.
enum ADLImageCache {
    static let shared = ADLImageCacheImpl()

    static func image(for url: URL, targetSize: CGSize) async -> UIImage? {
        await shared.image(for: url, targetSize: targetSize)
    }
}

final class ADLImageCacheImpl {
    private let cache = NSCache<NSURL, UIImage>()
    private let session: URLSession

    init(memoryLimit: Int = 20 * 1024 * 1024) {
        cache.totalCostLimit = memoryLimit
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 4 * 1024 * 1024, diskCapacity: 50 * 1024 * 1024)
        session = URLSession(configuration: config)
    }

    func image(for url: URL, targetSize: CGSize) async -> UIImage? {
        let key = url as NSURL

        if let cached = cache.object(forKey: key) {
            return cached
        }

        guard let (data, _) = try? await session.data(from: url),
              let rawImage = UIImage(data: data)
        else { return nil }

        let downsampled = downsample(data: data, to: targetSize)
        let result = downsampled ?? rawImage

        let cost = Int(result.size.width * result.size.height * 4)
        cache.setObject(result, forKey: key, cost: cost)

        return result
    }

    private func downsample(data: Data, to targetSize: CGSize) -> UIImage? {
        let scale: CGFloat = 3.0
        let maxDimensionInPixels = max(targetSize.width, targetSize.height) * scale

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxDimensionInPixels,
        ]

        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { return nil }

        return UIImage(cgImage: cgImage)
    }
}

/// Drop-in replacement for AsyncImage that uses ADLImageCache for
/// memory-efficient loading with automatic downsampling.
struct ADLCachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    let targetSize: CGSize
    @ViewBuilder let content: (Image) -> Content
    @ViewBuilder let placeholder: () -> Placeholder

    @State private var loadedImage: UIImage?
    @State private var isLoading = false

    var body: some View {
        Group {
            if let uiImage = loadedImage {
                content(Image(uiImage: uiImage))
            } else {
                placeholder()
                    .task { await load() }
            }
        }
    }

    private func load() async {
        guard let url, !isLoading else { return }
        isLoading = true
        loadedImage = await ADLImageCache.image(for: url, targetSize: targetSize)
        isLoading = false
    }
}
