import Foundation

struct StoryCard: Codable, Identifiable, Equatable {
    var id: String { headline }
    let headline: String
    let bullets: [String]
    let source: String?
    let url: String?
    let date: String?
}

struct Article: Codable, Identifiable, Equatable {
    var id: String { url }
    let title: String
    let source: String
    let url: String
    let snippet: String?
}

struct DebugQueryInfo: Codable, Equatable {
    let type: String
    let query: String
    let vectorQuery: String?
}

struct DebugInfo: Codable, Equatable {
    let queries: [DebugQueryInfo]
    let articleCount: Int?
    let cascadeStep: String?
}

struct Briefing: Codable, Identifiable, Equatable {
    var id: String { "\(topic)-\(generatedAt)" }
    let topic: String
    let emoji: String
    let summary: String
    let stories: [StoryCard]?
    let articles: [Article]
    let generatedAt: String
    let readingTime: Int?
    let model: String?
    let debugInfo: DebugInfo?

    var storyList: [StoryCard] {
        stories ?? []
    }
}

struct GenerateResponse: Codable {
    let briefings: [Briefing]
    let model: String?
}
