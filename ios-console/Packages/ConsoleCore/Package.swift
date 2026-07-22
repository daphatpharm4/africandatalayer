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
        ),
        .library(
            name: "ConsoleForms",
            targets: ["ConsoleForms"]
        ),
        .library(
            name: "ConsolePersistence",
            targets: ["ConsolePersistence"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", exact: "7.10.0")
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
        .target(
            name: "ConsoleForms",
            dependencies: ["ConsoleModels"],
            path: "Sources/ConsoleForms"
        ),
        .target(
            name: "ConsolePersistence",
            dependencies: [
                "ConsoleModels",
                .product(name: "GRDB", package: "GRDB.swift")
            ],
            path: "Sources/ConsolePersistence"
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
        ),
        .testTarget(
            name: "ConsoleFormsTests",
            dependencies: ["ConsoleForms", "ConsoleModels"],
            path: "Tests/ConsoleFormsTests"
        ),
        .testTarget(
            name: "ConsolePersistenceTests",
            dependencies: ["ConsolePersistence", "ConsoleModels"],
            path: "Tests/ConsolePersistenceTests"
        )
    ]
)
