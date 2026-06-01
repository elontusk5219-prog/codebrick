// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CodeBrickMenuBar",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "CodeBrickMenuBar",
            path: "Sources/CodeBrickMenuBar"
        )
    ]
)
