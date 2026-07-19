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
        ),
        .library(
            name: "ConsoleState",
            targets: ["ConsoleState"]
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
        .target(
            name: "ConsoleState",
            dependencies: ["ConsoleModels"],
            path: "Sources/ConsoleState"
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
        ),
        .testTarget(
            name: "ConsoleStateTests",
            dependencies: ["ConsoleState", "ConsoleModels"],
            path: "Tests/ConsoleStateTests"
        )
    ]
)
