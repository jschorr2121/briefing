import SwiftUI

extension Color {
    // Brand
    static let accent = Color(hex: "2563eb")
    static let accentLight = Color(hex: "3b82f6")
    static let accentDark = Color(hex: "1d4ed8")

    // Backgrounds (light theme matching web)
    static let bgPrimary = Color(hex: "f8fafc")
    static let bgSecondary = Color(hex: "f1f5f9")
    static let bgCard = Color.white
    static let bgCardHover = Color(hex: "f1f5f9")

    // Text
    static let textPrimary = Color(hex: "0f172a")
    static let textSecondary = Color(hex: "475569")
    static let textMuted = Color(hex: "94a3b8")

    // Semantic
    static let success = Color(hex: "22c55e")
    static let warning = Color(hex: "f59e0b")
    static let danger = Color(hex: "ef4444")
    static let info = Color(hex: "2563eb")

    // Borders
    static let borderDefault = Color(hex: "e2e8f0")
    static let borderLight = Color(hex: "cbd5e1")

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
