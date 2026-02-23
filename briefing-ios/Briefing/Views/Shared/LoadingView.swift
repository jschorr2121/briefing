import SwiftUI

struct LoadingSkeletonView: View {
    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.bgCard)
                    .frame(height: 200)
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
                    .fill(Color.accent)
                    .frame(width: 8, height: 8)
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
