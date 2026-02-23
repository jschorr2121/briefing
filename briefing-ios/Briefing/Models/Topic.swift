import Foundation

struct Topic: Codable, Identifiable, Equatable, Hashable {
    let id: String
    var name: String
    var emoji: String
    var enabled: Bool

    init(id: String, name: String, emoji: String, enabled: Bool = true) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.enabled = enabled
    }

    init(name: String, emoji: String = "\u{1F4F0}") {
        self.id = name.lowercased().replacingOccurrences(of: " ", with: "-")
        self.name = name
        self.emoji = emoji
        self.enabled = true
    }
}
