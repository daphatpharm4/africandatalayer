import ConsoleModels
import Foundation
import UIKit

/// Output formats offered by the analytics export panel.
enum ExportFormat: String, CaseIterable, Identifiable, Equatable, Sendable {
    case csv
    case geoJSON
    case pdf

    var id: String { rawValue }

    var fileExtension: String {
        switch self {
        case .csv: return "csv"
        case .geoJSON: return "geojson"
        case .pdf: return "pdf"
        }
    }
}

/// Seam `ExportPanelViewModel` depends on so tests can substitute a mock
/// writer instead of exercising real file I/O / `UIGraphicsPDFRenderer`.
/// `ExportService` is the production conformer.
protocol ExportWriting: Sendable {
    func write(rows: [ExportRow], features: [ExportFeature], format: ExportFormat, title: String) throws -> URL
}

/// Writes analytics export data to a file on disk in the requested format,
/// ready to hand to `UIActivityViewController`.
///
/// CSV/GeoJSON encoding is delegated to `ExportEncoding` (`ConsoleModels`)
/// — a pure, package-level encoder covered by `swift test` without a
/// simulator (see `ExportEncodingTests`). PDF rendering needs
/// `UIGraphicsPDFRenderer`, which requires UIKit, so it's implemented here
/// in the app target rather than in the cross-platform `ConsoleCore`
/// package (whose `ConsoleModels` target also builds for macOS).
/// `@unchecked Sendable`: the only stored property is `FileManager`, which
/// is thread-safe in practice (Apple's docs: "you can use this method from
/// multiple threads") but isn't marked `Sendable` in the SDK. `.default` is
/// a shared singleton; a caller-supplied instance is expected to be
/// similarly safe to use concurrently.
final class ExportService: ExportWriting, @unchecked Sendable {
    private static let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter @ 72dpi
    private static let pageMargin: CGFloat = 36
    private static let rowsPerPage = 40
    private static let rowHeight: CGFloat = 20
    private static let headerHeight: CGFloat = 96
    private static let footerHeight: CGFloat = 32

    /// Column widths (points) for id/name/type/lat/lon/capturedAt — sums to
    /// `pageRect.width - 2 * pageMargin` (540pt).
    private static let columnWidths: [CGFloat] = [80, 170, 90, 65, 65, 70]
    private static let columnTitles = ["ID", "Name", "Type", "Latitude", "Longitude", "Captured"]

    private static let navy = UIColor(red: 0x0f / 255, green: 0x2b / 255, blue: 0x46 / 255, alpha: 1)
    private static let terra = UIColor(red: 0xc8 / 255, green: 0x6b / 255, blue: 0x4a / 255, alpha: 1)
    private static let gold = UIColor(red: 0xf4 / 255, green: 0xc3 / 255, blue: 0x17 / 255, alpha: 1)
    private static let navyWash = UIColor(red: 0xf2 / 255, green: 0xf6 / 255, blue: 0xfa / 255, alpha: 1)
    private static let inkMuted = UIColor(red: 0x5b / 255, green: 0x6b / 255, blue: 0x7a / 255, alpha: 1)

    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    /// Encodes `rows`/`features` in `format` (`rows` drives CSV/PDF,
    /// `features` drives GeoJSON) and writes the result to a uniquely
    /// named file in the temporary directory, returning its URL.
    func write(rows: [ExportRow], features: [ExportFeature], format: ExportFormat, title: String) throws -> URL {
        let data: Data
        switch format {
        case .csv:
            data = ExportEncoding.csv(rows)
        case .geoJSON:
            data = try ExportEncoding.geoJSON(features)
        case .pdf:
            data = pdf(rows, title: title)
        }

        let url = fileManager.temporaryDirectory
            .appendingPathComponent("adl-export-\(UUID().uuidString)")
            .appendingPathExtension(format.fileExtension)
        try data.write(to: url, options: .atomic)
        return url
    }

    // MARK: - PDF rendering

    /// Renders `rows` as a US-Letter PDF table: a logo + title header and a
    /// "Page X of Y" footer on every page, paginated at `rowsPerPage` (40)
    /// data rows per page. Empty `rows` still renders one page (header,
    /// column headers, footer, no data rows) rather than empty `Data`.
    func pdf(_ rows: [ExportRow], title: String) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: Self.pageRect, format: UIGraphicsPDFRendererFormat())
        let pageCount = max(1, Int(ceil(Double(rows.count) / Double(Self.rowsPerPage))))

        return renderer.pdfData { context in
            for pageIndex in 0..<pageCount {
                context.beginPage()
                drawHeader(title: title, in: Self.pageRect)
                let start = pageIndex * Self.rowsPerPage
                let end = min(start + Self.rowsPerPage, rows.count)
                drawTable(rows: Array(rows[start..<end]))
                drawFooter(page: pageIndex + 1, of: pageCount, in: Self.pageRect)
            }
        }
    }

    /// Draws the "ADL" wordmark (three navy/terra/gold bars, echoing
    /// `ADLLogoMark`'s in-app rendering) plus the report title.
    private func drawHeader(title: String, in pageRect: CGRect) {
        let logoOrigin = CGPoint(x: Self.pageMargin, y: 24)
        let logoSize: CGFloat = 32
        UIBezierPath(roundedRect: CGRect(origin: logoOrigin, size: CGSize(width: logoSize, height: logoSize)), cornerRadius: 7)
            .withFill(Self.navy)

        let barColors: [UIColor] = [Self.gold, Self.terra, Self.gold]
        let barWidths: [CGFloat] = [0.62, 0.46, 0.30]
        var barY = logoOrigin.y + 6
        for (color, widthFraction) in zip(barColors, barWidths) {
            let barWidth = logoSize * widthFraction
            let barRect = CGRect(x: logoOrigin.x + (logoSize - barWidth) / 2, y: barY, width: barWidth, height: 3)
            UIBezierPath(roundedRect: barRect, cornerRadius: 1.5).withFill(color)
            barY += 8
        }

        let titleRect = CGRect(x: logoOrigin.x + logoSize + 12, y: 20, width: pageRect.width - Self.pageMargin - logoOrigin.x - logoSize - 12, height: 40)
        title.draw(
            in: titleRect,
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 15), .foregroundColor: Self.navy]
        )

        let ruleRect = CGRect(x: Self.pageMargin, y: Self.headerHeight - 4, width: pageRect.width - 2 * Self.pageMargin, height: 1)
        UIBezierPath(rect: ruleRect).withFill(Self.inkMuted.withAlphaComponent(0.3))
    }

    /// Draws the column-header row and one row per record, starting just
    /// below the page header.
    private func drawTable(rows: [ExportRow]) {
        var y = Self.headerHeight + 8

        drawTableRow(
            values: Self.columnTitles,
            y: y,
            font: UIFont.boldSystemFont(ofSize: 9),
            color: Self.navy,
            background: Self.navyWash
        )
        y += Self.rowHeight

        for (index, row) in rows.enumerated() {
            let values = [
                row.id,
                row.name,
                row.type,
                row.latitude.map { String(format: "%.4f", $0) } ?? "",
                row.longitude.map { String(format: "%.4f", $0) } ?? "",
                row.capturedAt ?? ""
            ]
            drawTableRow(
                values: values,
                y: y,
                font: UIFont.systemFont(ofSize: 9),
                color: .black,
                background: index.isMultiple(of: 2) ? nil : Self.navyWash.withAlphaComponent(0.5)
            )
            y += Self.rowHeight
        }
    }

    private func drawTableRow(values: [String], y: CGFloat, font: UIFont, color: UIColor, background: UIColor?) {
        if let background {
            let rowRect = CGRect(x: Self.pageMargin, y: y, width: Self.columnWidths.reduce(0, +), height: Self.rowHeight)
            UIBezierPath(rect: rowRect).withFill(background)
        }

        var x = Self.pageMargin
        for (value, width) in zip(values, Self.columnWidths) {
            let cellRect = CGRect(x: x + 4, y: y + 4, width: width - 8, height: Self.rowHeight - 4)
            value.draw(in: cellRect, withAttributes: [.font: font, .foregroundColor: color])
            x += width
        }
    }

    private func drawFooter(page: Int, of pageCount: Int, in pageRect: CGRect) {
        let footerText = "Page \(page) of \(pageCount)"
        let footerSize = footerText.size(withAttributes: [.font: UIFont.systemFont(ofSize: 9)])
        let footerOrigin = CGPoint(
            x: (pageRect.width - footerSize.width) / 2,
            y: pageRect.height - Self.footerHeight
        )
        footerText.draw(at: footerOrigin, withAttributes: [.font: UIFont.systemFont(ofSize: 9), .foregroundColor: Self.inkMuted])
    }
}

private extension UIBezierPath {
    func withFill(_ color: UIColor) {
        color.setFill()
        fill()
    }
}
