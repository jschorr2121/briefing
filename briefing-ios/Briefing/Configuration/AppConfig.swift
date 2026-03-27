import Foundation

enum AppConfig {
    #if DEBUG
    static let baseURL = "http://localhost:3000"
    #else
    static let baseURL = "https://briefing-five.vercel.app"
    #endif
    static let googleClientID = "814427665682-4chioe564tgqo9920satjmciivad2f1c.apps.googleusercontent.com"

    static let monthlyProductID = "com.briefing.pro.monthly"
    static let annualProductID = "com.briefing.pro.annual"
    static let productIDs: Set<String> = [monthlyProductID, annualProductID]

    static let bundleID = "com.briefing.app"

    static let freeDailyLimit = 3
    static let freeTopicLimit = 4
    static let maxHistoryCount = 10

    static let defaultTopics: [Topic] = [
        Topic(id: "ai", name: "AI & Tech", emoji: "\u{1F916}"),
        Topic(id: "world", name: "World News", emoji: "\u{1F30D}"),
        Topic(id: "finance", name: "Finance", emoji: "\u{1F4B0}"),
    ]

    static let suggestedTopics: [Topic] = [
        Topic(id: "sports", name: "Sports", emoji: "\u{26BD}"),
        Topic(id: "science", name: "Science", emoji: "\u{1F52C}"),
        Topic(id: "startups", name: "Startups", emoji: "\u{1F680}"),
        Topic(id: "basketball", name: "Basketball", emoji: "\u{1F3C0}"),
    ]

    enum Voice: String, CaseIterable, Identifiable {
        case alloy, echo, fable, onyx, nova, shimmer
        var id: String { rawValue }
        var displayName: String { rawValue.capitalized }
    }
}
