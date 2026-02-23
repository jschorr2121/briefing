import Foundation

struct Schedule: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    var email: String
    var topics: [String]
    var frequency: ScheduleFrequency
    var time: String
    var timezone: String
    var enabled: Bool
    let createdAt: String
    var updatedAt: String
}

enum ScheduleFrequency: String, Codable, CaseIterable, Identifiable {
    case daily, weekdays, weekly
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

struct ScheduleListResponse: Codable {
    let schedules: [Schedule]
}
