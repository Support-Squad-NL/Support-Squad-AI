// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "SupportSquadAIKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "SupportSquadAIProtocol", targets: ["SupportSquadAIProtocol"]),
        .library(name: "SupportSquadAIKit", targets: ["SupportSquadAIKit"]),
        .library(name: "SupportSquadAIChatUI", targets: ["SupportSquadAIChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "SupportSquadAIProtocol",
            path: "Sources/SupportSquadAIProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "SupportSquadAIKit",
            dependencies: [
                "SupportSquadAIProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/SupportSquadAIKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "SupportSquadAIChatUI",
            dependencies: [
                "SupportSquadAIKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/SupportSquadAIChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "SupportSquadAIKitTests",
            dependencies: ["SupportSquadAIKit", "SupportSquadAIChatUI"],
            path: "Tests/SupportSquadAIKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
