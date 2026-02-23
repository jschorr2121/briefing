import SwiftUI

// MARK: - FadeIn

struct FadeInModifier: ViewModifier {
    @State private var isVisible = false
    let delay: Double

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                withAnimation(.easeOut(duration: 0.3).delay(delay)) {
                    isVisible = true
                }
            }
    }
}

// MARK: - SlideIn

struct SlideInModifier: ViewModifier {
    @State private var isVisible = false
    let edge: Edge
    let delay: Double

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(
                x: edge == .leading ? (isVisible ? 0 : -20) : (edge == .trailing ? (isVisible ? 0 : 20) : 0),
                y: edge == .bottom ? (isVisible ? 0 : 20) : (edge == .top ? (isVisible ? 0 : -20) : 0)
            )
            .onAppear {
                withAnimation(.easeOut(duration: 0.25).delay(delay)) {
                    isVisible = true
                }
            }
    }
}

// MARK: - Shimmer

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, .white.opacity(0.08), .clear],
                    startPoint: .init(x: phase - 0.5, y: 0.5),
                    endPoint: .init(x: phase + 0.5, y: 0.5)
                )
            )
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1.5
                }
            }
    }
}

extension View {
    func fadeIn(delay: Double = 0) -> some View {
        modifier(FadeInModifier(delay: delay))
    }

    func slideIn(from edge: Edge = .bottom, delay: Double = 0) -> some View {
        modifier(SlideInModifier(edge: edge, delay: delay))
    }

    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
