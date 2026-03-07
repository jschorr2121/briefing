import SwiftUI

extension Color {
    // Brand
    static let accent = Color(hex: "2563eb")
    static let accentLight = Color(hex: "3b82f6")
    static let accentDark = Color(hex: "1d4ed8")

    // Backgrounds
    static let bgPrimary = Color(hex: "0f172a")
    static let bgSecondary = Color(hex: "1e293b")
    static let bgCard = Color(hex: "1e293b")
    static let bgCardHover = Color(hex: "334155")

    // Text
    static let textPrimary = Color(hex: "f8fafc")
    static let textSecondary = Color(hex: "94a3b8")
    static let textMuted = Color(hex: "64748b")

    // Semantic
    static let success = Color(hex: "22c55e")
    static let warning = Color(hex: "f59e0b")
    static let danger = Color(hex: "ef4444")
    static let info = Color(hex: "60a5fa")

    // Borders
    static let borderDefault = Color(hex: "334155")
    static let borderLight = Color(hex: "475569")

    init(hex: String) {
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
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
