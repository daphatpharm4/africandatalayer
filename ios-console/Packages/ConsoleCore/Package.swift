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
        ),
        .library(
            name: "ConsoleAPI",
            targets: ["ConsoleAPI"]
        )
    ],
    targets: [
        .target(
            name: "ConsoleModels",
            path: "Sources/ConsoleModels"
        ),
        .target(
            name: "ConsoleAPI",
            dependencies: ["ConsoleModels"],
            path: "Sources/ConsoleAPI"
        ),
        .testTarget(
            name: "ConsoleModelsTests",
            dependencies: ["ConsoleModels"],
            path: "Tests/ConsoleModelsTests"
        ),
        .testTarget(
            name: "ConsoleAPITests",
            dependencies: ["ConsoleAPI", "ConsoleModels"],
            path: "Tests/ConsoleAPITests"
        )
    ]
)
