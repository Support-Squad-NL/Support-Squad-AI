import Foundation

public enum SupportSquadAIChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(SupportSquadAIChatEventPayload)
    case agent(SupportSquadAIAgentEventPayload)
    case seqGap
}

public protocol SupportSquadAIChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> SupportSquadAIChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [SupportSquadAIChatAttachmentPayload]) async throws -> SupportSquadAIChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> SupportSquadAIChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<SupportSquadAIChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension SupportSquadAIChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "SupportSquadAIChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> SupportSquadAIChatSessionsListResponse {
        throw NSError(
            domain: "SupportSquadAIChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
