import SwiftUI

struct UpgradePromptView: View {
    @Binding var isPresented: Bool
    let usageUsed: Int
    let usageLimit: Int?

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "bolt.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.accent)

            VStack(spacing: 8) {
                Text("Daily Limit Reached")
                    .font(.sectionTitle)
                    .foregroundStyle(Color.textPrimary)

                if let limit = usageLimit {
                    Text("You've used \(usageUsed) of \(limit) free briefings today.")
                        .font(.bodyRegular)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            VStack(spacing: 12) {
                NavigationLink(destination: PricingView()) {
                    Text("Upgrade to Pro")
                        .font(.buttonLabel)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
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
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 32)
    }
}
