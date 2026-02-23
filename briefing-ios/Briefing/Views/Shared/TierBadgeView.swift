import SwiftUI

struct TierBadgeView: View {
    let tier: String

    var body: some View {
        Text(tier.uppercased())
            .font(.caption)
            .fontWeight(.bold)
            .foregroundStyle(tier == "pro" ? Color.accent : Color.textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                (tier == "pro" ? Color.accent : Color.textSecondary).opacity(0.15)
            )
            .clipShape(Capsule())
    }
}
