import SwiftUI
import UIKit

// Editorial ink-and-paper palette. Every token adapts to light/dark so the
// briefing reads like print by day and a night edition after dark.
extension Color {
    // Brand — broadsheet red, used sparingly (masthead, live states, links)
    static let accent = Color(light: "A8201A", dark: "E05252")
    static let accentLight = Color(light: "C24842", dark: "EC7B7B")
    static let accentDark = Color(light: "8A1A15", dark: "C93B3B")

    // Surfaces — warm-neutral paper, never pure white or black
    static let bgPrimary = Color(light: "FAF9F7", dark: "141312")
    static let bgSecondary = Color(light: "F1EFEB", dark: "1E1C1A")
    static let bgCard = Color(light: "FFFFFF", dark: "1B1917")
    static let bgCardHover = Color(light: "F1EFEB", dark: "242220")

    // Ink
    static let textPrimary = Color(light: "1A1815", dark: "EAE8E4")
    static let textSecondary = Color(light: "55524C", dark: "A8A49C")
    static let textMuted = Color(light: "8C8880", dark: "6E6A63")

    // Semantic
    static let success = Color(light: "2E7D46", dark: "5BBF7E")
    static let warning = Color(light: "B45309", dark: "E8A33D")
    static let danger = Color(light: "B42318", dark: "E05252")
    static let info = accent

    // Rules — hairlines, the workhorse of editorial layout
    static let borderDefault = Color(light: "E6E3DD", dark: "2C2A27")
    static let borderLight = Color(light: "D8D4CC", dark: "3A3733")

    init(light: String, dark: String) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        })
    }

    init(hex: String) {
        self.init(uiColor: UIColor(hex: hex))
    }
}

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}
