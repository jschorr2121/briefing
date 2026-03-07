import SwiftUI

struct BriefingCardView: View {
    let briefing: Briefing
    @State private var isExpanded = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text("\(briefing.emoji) \(briefing.topic)")
                        .font(.cardTitle)
                        .foregroundStyle(Color.textPrimary)

                    Spacer()

                    Image(systemName: "chevron.down")
                        .font(.bodySmall)
                        .foregroundStyle(Color.textMuted)
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                }
                .padding()
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 16) {
                    // Summary
                    Text(briefing.summary)
                        .font(.bodyRegular)
                        .foregroundStyle(Color.textSecondary)
                        .padding(.horizontal)

                    // Story cards carousel
                    if !briefing.storyList.isEmpty {
                        StoryCarouselView(stories: briefing.storyList)
                    }

                    // Copy/Share actions
                    HStack(spacing: 12) {
                        Button {
                            UIPasteboard.general.string = formatBriefingText()
                            HapticManager.notification(.success)
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                                .font(.bodySmall)
                                .foregroundStyle(Color.textMuted)
                        }

                        ShareLink(item: formatBriefingText()) {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(.bodySmall)
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
        }
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
    }

    private func formatBriefingText() -> String {
        var text = "\(briefing.emoji) \(briefing.topic)\n\n\(briefing.summary)\n"
        for story in briefing.storyList {
            text += "\n\(story.headline)\n"
            for bullet in story.bullets {
                text += "  - \(bullet)\n"
            }
        }
        return text
    }
}

// MARK: - Story Carousel

struct StoryCarouselView: View {
    let stories: [StoryCard]
    @State private var currentIndex = 0

    var body: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                        StoryCardView(story: story)
                            .containerRelativeFrame(.horizontal, count: 1, spacing: 0)
                            .id(index)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: Binding(
                get: { currentIndex },
                set: { if let v = $0 { currentIndex = v } }
            ))
            .frame(height: 200)

            // Page dots
            if stories.count > 1 {
                HStack(spacing: 6) {
                    ForEach(0..<stories.count, id: \.self) { i in
                        Circle()
                            .fill(i == currentIndex ? Color.accent : Color.textMuted.opacity(0.4))
                            .frame(width: 6, height: 6)
                    }
                }
            }
        }
    }
}
