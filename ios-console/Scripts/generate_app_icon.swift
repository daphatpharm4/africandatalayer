#!/usr/bin/env swift
//
// generate_app_icon.swift
//
// Renders the ADL Console app icon (1024x1024 PNG) with CoreGraphics — no
// network, no external assets, no dependency on the agent app's "Data"
// mascot (which is agent-app-only, per CLAUDE.md's design-system rules).
//
// Mark: three stacked, tapering rounded bars on a navy field — a literal
// "data layer" glyph distinct from the agent app's character mascot, built
// from the same brand palette (navy / gold / terracotta).
//
// Usage: swift Scripts/generate_app_icon.swift
// Output: ADLConsole/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
//
import AppKit
import CoreGraphics
import Foundation

let size = 1024.0
let rect = CGRect(x: 0, y: 0, width: size, height: size)

guard let ctx = CGContext(
    data: nil,
    width: Int(size),
    height: Int(size),
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    // `.noneSkipLast`, not `.premultipliedLast`: App Store Connect rejects
    // app icons that carry an alpha channel, even fully-opaque ones — this
    // renders straight to opaque RGB with no channel to strip later.
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
    fatalError("Could not create CGContext")
}

func color(_ hex: UInt32, alpha: CGFloat = 1) -> CGColor {
    let r = CGFloat((hex >> 16) & 0xFF) / 255
    let g = CGFloat((hex >> 8) & 0xFF) / 255
    let b = CGFloat(hex & 0xFF) / 255
    return CGColor(red: r, green: g, blue: b, alpha: alpha)
}

let navy = color(0x0F2B46)
let navyLight = color(0x18406A)
let gold = color(0xF4C317)
let terra = color(0xC86B4A)

// Background — flat navy field. No pre-rounded corners / no alpha: iOS
// masks the app icon itself, and App Store Connect rejects icons that
// already have transparency or rounded corners baked in.
ctx.setFillColor(navy)
ctx.fill(rect)

// Subtle top-to-bottom vignette so the flat navy isn't completely dead —
// restrained per the brand's "utilitarian with soul" direction, not a
// gradient hero.
if let gradient = CGGradient(
    colorsSpace: CGColorSpaceCreateDeviceRGB(),
    colors: [navyLight, navy] as CFArray,
    locations: [0, 1]
) {
    ctx.saveGState()
    ctx.addRect(rect)
    ctx.clip()
    ctx.drawLinearGradient(
        gradient,
        start: CGPoint(x: size / 2, y: size),
        end: CGPoint(x: size / 2, y: 0),
        options: []
    )
    ctx.restoreGState()
}

// Three stacked, tapering rounded bars — the "data layer" glyph. Widest at
// the bottom (navy-adjacent, drawn in gold) narrowing toward the top (terra),
// centered in the safe zone away from the corner mask.
struct Bar {
    let widthFraction: CGFloat
    let color: CGColor
}

let bars: [Bar] = [
    Bar(widthFraction: 0.62, color: gold),
    Bar(widthFraction: 0.46, color: terra),
    Bar(widthFraction: 0.30, color: gold),
]

let barHeight = size * 0.10
let barSpacing = size * 0.075
let cornerRadius = barHeight * 0.4
let totalStackHeight = CGFloat(bars.count) * barHeight + CGFloat(bars.count - 1) * barSpacing
var y = (size - totalStackHeight) / 2 + totalStackHeight - barHeight

for bar in bars {
    let barWidth = size * bar.widthFraction
    let x = (size - barWidth) / 2
    let barRect = CGRect(x: x, y: y, width: barWidth, height: barHeight)
    let path = CGPath(roundedRect: barRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
    ctx.setFillColor(bar.color)
    ctx.addPath(path)
    ctx.fillPath()
    y -= barHeight + barSpacing
}

guard let image = ctx.makeImage() else {
    fatalError("Could not render image")
}

let outputURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .appendingPathComponent("ADLConsole/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")

guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.png" as CFString, 1, nil) else {
    fatalError("Could not create image destination at \(outputURL.path)")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fatalError("Could not write PNG to \(outputURL.path)")
}

print("Wrote \(outputURL.path)")
