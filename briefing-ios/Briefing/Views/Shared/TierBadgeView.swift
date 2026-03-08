import SwiftUI

struct TierBadgeView: View {
    let tier: String

    var body: some View {
        Text(tier.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tier == "pro" ? Color.accent : Color.textMuted)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(
                (tier == "pro" ? Color.accent : Color.textMuted).opacity(0.12)
            )
            .clipShape(Capsule())
    }
}
