import Foundation
import SwiftData

@Model
final class BriefingHistoryEntry {
    var entryId: String
    var briefingsData: Data
    var generatedAt: String
    var topicNames: [String]

    init(briefings: [Briefing]) {
        self.entryId = UUID().uuidString
        self.briefingsData = (try? JSONEncoder().encode(briefings)) ?? Data()
        self.generatedAt = ISO8601DateFormatter().string(from: Date())
        self.topicNames = briefings.map(\.topic)
    }

    var briefings: [Briefing] {
        (try? JSONDecoder().decode([Briefing].self, from: briefingsData)) ?? []
    }
}
