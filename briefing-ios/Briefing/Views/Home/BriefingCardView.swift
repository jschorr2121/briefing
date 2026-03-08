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
                HStack(spacing: 12) {
                    // Icon container (like web UI)
                    Image(systemName: "newspaper")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.textMuted)
                        .frame(width: 40, height: 40)
                        .background(Color.bgCardHover)
                        .clipShape(RoundedRectangle(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(briefing.topic)
                            .font(.cardTitle)
                            .foregroundStyle(Color.textPrimary)

                        HStack(spacing: 8) {
                            if let readingTime = briefing.readingTime, readingTime > 0 {
                                Label("\(readingTime) min read", systemImage: "clock")
                            }
                            Label("\(briefing.storyList.count) stories", systemImage: "doc.text")
                        }
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                    }

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
                    // Summary — formatted with highlights
                    SummaryView(text: briefing.summary)
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

/// Formats the summary paragraph into a more readable layout.
/// Splits on sentences and bolds key phrases (text between ** markers).
struct SummaryView: View {
    let text: String

    var body: some View {
        let sentences = splitIntoSentences(text)

        if sentences.count > 1 {
            // Multiple sentences: render as spaced paragraphs with a leading accent bar
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(sentences.enumerated()), id: \.offset) { _, sentence in
                    HStack(alignment: .top, spacing: 10) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(Color.accent.opacity(0.3))
                            .frame(width: 3)

                        formattedText(sentence)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textSecondary)
                            .lineSpacing(4)
                    }
                }
            }
        } else {
            // Single sentence/short summary
            formattedText(text)
                .font(.bodyRegular)
                .foregroundStyle(Color.textSecondary)
                .lineSpacing(4)
        }
    }

    /// Renders text with **bold** markdown markers
    private func formattedText(_ input: String) -> Text {
        let parts = input.components(separatedBy: "**")
        var result = Text("")
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                // Bold part
                result = result + Text(part).bold().foregroundColor(Color.textPrimary)
            } else {
                result = result + Text(part)
            }
        }
        return result
    }

    private func splitIntoSentences(_ text: String) -> [String] {
        // Split on period followed by space or end, keeping meaningful chunks
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)

        // First try splitting on double newlines (paragraph breaks)
        let paragraphs = cleaned.components(separatedBy: "\n\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if paragraphs.count > 1 {
            return paragraphs
        }

        // Otherwise split on ". " to get sentence groups (keep 2-3 sentences per group)
        let sentences = cleaned.components(separatedBy: ". ").filter { !$0.isEmpty }
        if sentences.count <= 2 { return [cleaned] }

        var groups: [String] = []
        var current = ""
        for (i, sentence) in sentences.enumerated() {
            if !current.isEmpty { current += ". " }
            current += sentence
            // Group every 2 sentences
            if (i + 1) % 2 == 0 || i == sentences.count - 1 {
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
                    Text("Story \(currentIndex + 1) of \(stories.count)")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)

                    Spacer()

                    HStack(spacing: 8) {
                        Button {
                            withAnimation {
                                currentIndex = max(0, currentIndex - 1)
                            }
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.caption.bold())
                                .foregroundStyle(currentIndex > 0 ? Color.textSecondary : Color.textMuted.opacity(0.3))
                        }
                        .disabled(currentIndex == 0)

                        Text("\u{2022}")
                            .foregroundStyle(Color.textMuted.opacity(0.3))

                        Button {
                            withAnimation {
                                currentIndex = min(stories.count - 1, currentIndex + 1)
                            }
                        } label: {
                            Image(systemName: "chevron.right")
                                .font(.caption.bold())
                                .foregroundStyle(currentIndex < stories.count - 1 ? Color.textSecondary : Color.textMuted.opacity(0.3))
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
