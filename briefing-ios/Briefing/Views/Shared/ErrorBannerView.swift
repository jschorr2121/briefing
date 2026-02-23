import SwiftUI

struct ErrorBannerView: View {
    let message: String
    var onRetry: (() -> Void)?
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.danger)

            Text(message)
                .font(.bodySmall)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(3)

            Spacer()

            if let onRetry {
                Button("Retry") {
                    onRetry()
                }
                .font(.bodySmall.bold())
                .foregroundStyle(Color.accent)
            }

            if let onDismiss {
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.bodySmall)
                        .foregroundStyle(Color.textMuted)
                }
            }
        }
        .padding()
        .background(Color.danger.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.danger.opacity(0.3), lineWidth: 1)
        )
    }
}
