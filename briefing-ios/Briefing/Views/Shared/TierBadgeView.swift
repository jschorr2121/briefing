import SwiftUI

struct TierBadgeView: View {
    let tier: String

    var body: some View {
        Text(tier.uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(1.0)
            .foregroundStyle(tier == "pro" ? Color.accent : Color.textMuted)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(tier == "pro" ? Color.accent : Color.borderLight, lineWidth: 1)
            )
    }
}
