import SwiftUI

struct ErrorBannerView: View {
    let message: String
    var onRetry: (() -> Void)?
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(Color.danger)
                .frame(width: 3)

            Text(message)
                .font(.bodySmall)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(3)
                .padding(.vertical, 12)

            Spacer()

            HStack(spacing: 12) {
                if let onRetry {
                    Button("Retry") {
                        onRetry()
                    }
                    .font(.bodySmall.bold())
                    .foregroundStyle(Color.danger)
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
            .padding(.vertical, 12)
            .padding(.trailing, 12)
        }
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
    }
}
