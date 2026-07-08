import SwiftUI

struct UpgradePromptView: View {
    @Binding var isPresented: Bool
    let usageUsed: Int
    let usageLimit: Int?

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 12) {
                KickerText("Free edition", color: .accent)

                Text("Daily Limit Reached")
                    .font(.sectionTitle)
                    .foregroundStyle(Color.textPrimary)

                if let limit = usageLimit {
                    Text("You've read \(usageUsed) of \(limit) free briefings today.")
                        .font(.bodyRegular)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            VStack(spacing: 12) {
                NavigationLink(destination: PricingView()) {
                    Text("Upgrade to Pro")
                        .font(.buttonLabel)
                        .foregroundStyle(Color.bgPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Button("Maybe Later") {
                    isPresented = false
                }
                .font(.bodyRegular)
                .foregroundStyle(Color.textMuted)
            }
        }
        .padding(32)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
        .padding(.horizontal, 32)
    }
}
