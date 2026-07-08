import SwiftUI

// Editorial type system: New York (serif) carries the voice — masthead,
// section titles, headlines, summaries. SF handles UI chrome — labels,
// buttons, captions, metadata.
extension Font {
    // Serif voice
    static let masthead = Font.system(size: 34, weight: .heavy, design: .serif)
    static let heroTitle = Font.system(size: 28, weight: .bold, design: .serif)
    static let sectionTitle = Font.system(size: 22, weight: .bold, design: .serif)
    static let cardTitle = Font.system(size: 19, weight: .semibold, design: .serif)
    static let headline = Font.system(size: 17, weight: .semibold, design: .serif)
    static let bodySerif = Font.system(size: 16, weight: .regular, design: .serif)

    // UI chrome
    static let bodyLarge = Font.system(size: 16, weight: .regular)
    static let bodyRegular = Font.system(size: 15, weight: .regular)
    static let bodySmall = Font.system(size: 13, weight: .regular)
    static let caption = Font.system(size: 11, weight: .medium)
    static let kicker = Font.system(size: 11, weight: .semibold)
    static let buttonLabel = Font.system(size: 16, weight: .semibold)
    static let chipLabel = Font.system(size: 14, weight: .medium)
}

// Uppercase tracked label — the newspaper "kicker" above a section.
struct KickerText: View {
    let text: String
    var color: Color = .textMuted

    init(_ text: String, color: Color = .textMuted) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(.kicker)
            .tracking(1.4)
            .foregroundStyle(color)
    }
}
