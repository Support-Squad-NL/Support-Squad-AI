import Foundation

public enum SupportSquadAICameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum SupportSquadAICameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum SupportSquadAICameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum SupportSquadAICameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct SupportSquadAICameraSnapParams: Codable, Sendable, Equatable {
    public var facing: SupportSquadAICameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: SupportSquadAICameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: SupportSquadAICameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: SupportSquadAICameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct SupportSquadAICameraClipParams: Codable, Sendable, Equatable {
    public var facing: SupportSquadAICameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: SupportSquadAICameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: SupportSquadAICameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: SupportSquadAICameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
