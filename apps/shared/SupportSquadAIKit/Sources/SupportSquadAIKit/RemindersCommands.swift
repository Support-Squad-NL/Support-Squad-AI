import Foundation

public enum SupportSquadAIRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum SupportSquadAIReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct SupportSquadAIRemindersListParams: Codable, Sendable, Equatable {
    public var status: SupportSquadAIReminderStatusFilter?
    public var limit: Int?

    public init(status: SupportSquadAIReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct SupportSquadAIRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct SupportSquadAIReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct SupportSquadAIRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [SupportSquadAIReminderPayload]

    public init(reminders: [SupportSquadAIReminderPayload]) {
        self.reminders = reminders
    }
}

public struct SupportSquadAIRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: SupportSquadAIReminderPayload

    public init(reminder: SupportSquadAIReminderPayload) {
        self.reminder = reminder
    }
}
