// swift-tools-version: 6.2
// Package manifest for the SupportSquadAI macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "SupportSquadAI",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "SupportSquadAIIPC", targets: ["SupportSquadAIIPC"]),
        .library(name: "SupportSquadAIDiscovery", targets: ["SupportSquadAIDiscovery"]),
        .executable(name: "SupportSquadAI", targets: ["SupportSquadAI"]),
        .executable(name: "supportsquadai-mac", targets: ["SupportSquadAIMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/SupportSquadAIKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "SupportSquadAIIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "SupportSquadAIDiscovery",
            dependencies: [
                .product(name: "SupportSquadAIKit", package: "SupportSquadAIKit"),
            ],
            path: "Sources/SupportSquadAIDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "SupportSquadAI",
            dependencies: [
                "SupportSquadAIIPC",
                "SupportSquadAIDiscovery",
                .product(name: "SupportSquadAIKit", package: "SupportSquadAIKit"),
                .product(name: "SupportSquadAIChatUI", package: "SupportSquadAIKit"),
                .product(name: "SupportSquadAIProtocol", package: "SupportSquadAIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/SupportSquadAI.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "SupportSquadAIMacCLI",
            dependencies: [
                "SupportSquadAIDiscovery",
                .product(name: "SupportSquadAIKit", package: "SupportSquadAIKit"),
                .product(name: "SupportSquadAIProtocol", package: "SupportSquadAIKit"),
            ],
            path: "Sources/SupportSquadAIMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "SupportSquadAIIPCTests",
            dependencies: [
                "SupportSquadAIIPC",
                "SupportSquadAI",
                "SupportSquadAIDiscovery",
                .product(name: "SupportSquadAIProtocol", package: "SupportSquadAIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
