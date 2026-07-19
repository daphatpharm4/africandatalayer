// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "ConsoleCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "ConsoleModels",
            targets: ["ConsoleModels"]
        )
    ],
    targets: [
        .target(
            name: "ConsoleModels",
            path: "Sources/ConsoleModels"
        ),
        .testTarget(
            name: "ConsoleModelsTests",
            dependencies: ["ConsoleModels"],
            path: "Tests/ConsoleModelsTests"
        )
    ]
)
