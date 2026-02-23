import Foundation

struct BriefingSettings: Codable, Equatable {
    var briefingLength: BriefingLength
    var includeLinks: Bool
    var tone: BriefingTone
    var voice: String

    static let `default` = BriefingSettings(
        briefingLength: .medium,
        includeLinks: true,
        tone: .professional,
        voice: "nova"
    )
}

enum BriefingLength: String, Codable, CaseIterable, Identifiable {
    case short, medium, long
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum BriefingTone: String, Codable, CaseIterable, Identifiable {
    case casual, professional, technical
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}
