import SwiftUI

struct LoadingSkeletonView: View {
    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<3, id: \.self) { i in
                VStack(alignment: .leading, spacing: 12) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.bgSecondary)
                        .frame(width: 80, height: 10)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.bgSecondary)
                        .frame(width: 200, height: 18)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.bgSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 12)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.bgSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 12)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.bgSecondary)
                        .frame(width: 240, height: 12)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.borderDefault, lineWidth: 1)
                )
                .shimmer()
                .fadeIn(delay: Double(i) * 0.1)
            }
        }
        .padding(.horizontal)
    }
}

struct LoadingDots: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.bgPrimary)
                    .frame(width: 7, height: 7)
                    .scaleEffect(phase == i ? 1.3 : 0.7)
                    .animation(
                        .easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15),
                        value: phase
                    )
            }
        }
        .onAppear { phase = 2 }
    }
}
