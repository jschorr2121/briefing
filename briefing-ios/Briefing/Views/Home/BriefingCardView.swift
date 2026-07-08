import SwiftUI

struct BriefingCardView: View {
    let briefing: Briefing
    @State private var isExpanded = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Rectangle()
                                .fill(Color.accent)
                                .frame(width: 20, height: 2)

                            KickerText("Section", color: .accent)
                        }

                        Text(briefing.topic)
                            .font(.cardTitle)
                            .foregroundStyle(Color.textPrimary)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 6) {
                            if let readingTime = briefing.readingTime, readingTime > 0 {
                                Text("\(readingTime) min read")
                                Text("·")
                            }
                            Text("\(briefing.storyList.count) stories")
                        }
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                    }

                    Spacer()

                    Image(systemName: "chevron.down")
                        .font(.bodySmall)
                        .foregroundStyle(Color.textMuted)
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                        .padding(.top, 4)
                }
                .padding()
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 16) {
                    // Summary — serif body copy
                    SummaryView(text: briefing.summary)
                        .padding(.horizontal)

                    // Story cards carousel
                    if !briefing.storyList.isEmpty {
                        StoryCarouselView(stories: briefing.storyList)
                    }

                    // Copy/Share actions
                    HStack(spacing: 16) {
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
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    private func formatBriefingText() -> String {
        var text = "\(briefing.topic)\n\n\(briefing.summary)\n"
        for story in briefing.storyList {
            text += "\n\(story.headline)\n"
            for bullet in story.bullets {
                text += "  - \(bullet)\n"
            }
        }
        return text
    }
}

// MARK: - Summary View

/// Renders the summary as serif editorial paragraphs, bolding **key phrases**.
struct SummaryView: View {
    let text: String

    var body: some View {
        let paragraphs = splitIntoParagraphs(text)

        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                formattedText(paragraph)
                    .font(.bodySerif)
                    .foregroundStyle(Color.textSecondary)
                    .lineSpacing(6)
            }
        }
    }

    /// Renders text with **bold** markdown markers
    private func formattedText(_ input: String) -> Text {
        let parts = input.components(separatedBy: "**")
        var result = Text("")
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                result = result + Text(part).bold().foregroundColor(Color.textPrimary)
            } else {
                result = result + Text(part)
            }
        }
        return result
    }

    private func splitIntoParagraphs(_ text: String) -> [String] {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)

        // Prefer explicit paragraph breaks
        let paragraphs = cleaned.components(separatedBy: "\n\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if paragraphs.count > 1 {
            return paragraphs
        }

        // Otherwise group sentences into readable paragraphs
        let sentences = cleaned.components(separatedBy: ". ").filter { !$0.isEmpty }
        if sentences.count <= 3 { return [cleaned] }

        var groups: [String] = []
        var current = ""
        for (i, sentence) in sentences.enumerated() {
            if !current.isEmpty { current += ". " }
            current += sentence
            if (i + 1) % 3 == 0 || i == sentences.count - 1 {
                if !current.hasSuffix(".") { current += "." }
                groups.append(current)
                current = ""
            }
        }
        return groups
    }
}

// MARK: - Story Carousel

struct StoryCarouselView: View {
    let stories: [StoryCard]
    @State private var currentIndex = 0

    var body: some View {
        VStack(spacing: 8) {
            // Navigation header
            if stories.count > 1 {
                HStack {
                    KickerText("Story \(currentIndex + 1) of \(stories.count)")

                    Spacer()

                    HStack(spacing: 12) {
                        Button {
                            withAnimation {
                                currentIndex = max(0, currentIndex - 1)
                            }
                        } label: {
                            Image(systemName: "arrow.left")
                                .font(.caption.bold())
                                .foregroundStyle(currentIndex > 0 ? Color.textPrimary : Color.textMuted.opacity(0.3))
                        }
                        .disabled(currentIndex == 0)

                        Button {
                            withAnimation {
                                currentIndex = min(stories.count - 1, currentIndex + 1)
                            }
                        } label: {
                            Image(systemName: "arrow.right")
                                .font(.caption.bold())
                                .foregroundStyle(currentIndex < stories.count - 1 ? Color.textPrimary : Color.textMuted.opacity(0.3))
                        }
                        .disabled(currentIndex == stories.count - 1)
                    }
                }
                .padding(.horizontal)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                        StoryCardView(story: story, index: index)
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
            .frame(minHeight: 220)
        }
    }
}
