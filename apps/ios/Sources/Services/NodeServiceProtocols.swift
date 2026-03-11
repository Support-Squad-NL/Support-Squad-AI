import CoreLocation
import Foundation
import SupportSquadAIKit
import UIKit

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: SupportSquadAICameraSnapParams) async throws -> (format: String, base64: String, width: Int, height: Int)
    func clip(params: SupportSquadAICameraClipParams) async throws -> (format: String, base64: String, durationMs: Int, hasAudio: Bool)
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: SupportSquadAILocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: SupportSquadAILocationGetParams,
        desiredAccuracy: SupportSquadAILocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: SupportSquadAILocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

protocol DeviceStatusServicing: Sendable {
    func status() async throws -> SupportSquadAIDeviceStatusPayload
    func info() -> SupportSquadAIDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: SupportSquadAIPhotosLatestParams) async throws -> SupportSquadAIPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: SupportSquadAIContactsSearchParams) async throws -> SupportSquadAIContactsSearchPayload
    func add(params: SupportSquadAIContactsAddParams) async throws -> SupportSquadAIContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: SupportSquadAICalendarEventsParams) async throws -> SupportSquadAICalendarEventsPayload
    func add(params: SupportSquadAICalendarAddParams) async throws -> SupportSquadAICalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: SupportSquadAIRemindersListParams) async throws -> SupportSquadAIRemindersListPayload
    func add(params: SupportSquadAIRemindersAddParams) async throws -> SupportSquadAIRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: SupportSquadAIMotionActivityParams) async throws -> SupportSquadAIMotionActivityPayload
    func pedometer(params: SupportSquadAIPedometerParams) async throws -> SupportSquadAIPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: SupportSquadAIWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
