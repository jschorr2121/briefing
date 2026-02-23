import SwiftUI

struct TopicSelectorView: View {
    @Bindable var vm: HomeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Input row
            HStack(spacing: 8) {
                TextField(
                    vm.atTopicLimit ? "Maximum \(vm.topicLimit) topics" : "Add a topic...",
                    text: $vm.newTopicName
                )
                    .font(.bodyRegular)
                    .foregroundStyle(Color.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.borderDefault, lineWidth: 1)
                    )
                    .submitLabel(.done)
                    .onSubmit { vm.addTopic() }
                    .disabled(vm.atTopicLimit)
                    .opacity(vm.atTopicLimit ? 0.5 : 1)

                Button {
                    vm.addTopic()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Color.accent)
                }
                .disabled(vm.newTopicName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.atTopicLimit)
            }

            // Topic count
            Text("\(vm.topics.count)/\(vm.topicLimit) topics")
                .font(.caption)
                .foregroundStyle(Color.textMuted)

            // Selected topics
            if !vm.topics.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(vm.topics) { topic in
                        TopicChipView(
                            topic: topic,
                            onToggle: { vm.toggleTopic(topic) },
                            onRemove: { vm.removeTopic(topic) }
                        )
                    }
                }
            }

            // Suggestions
            let remainingSuggestions = AppConfig.suggestedTopics.filter { suggestion in
                !vm.topics.contains(where: { $0.id == suggestion.id })
            }

            if !remainingSuggestions.isEmpty && !vm.atTopicLimit {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Suggestions")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)

                    FlowLayout(spacing: 6) {
                        ForEach(remainingSuggestions) { topic in
                            Button {
                                vm.addSuggestedTopic(topic)
                            } label: {
                                Text("\(topic.emoji) \(topic.name)")
                                    .font(.bodySmall)
                                    .foregroundStyle(Color.textSecondary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.bgCard.opacity(0.6))
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(Color.borderDefault.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4]))
                                    )
                            }
                        }
                    }
                }
            }
        }
        .padding(.horizontal)
    }
}

struct TopicChipView: View {
    let topic: Topic
    let onToggle: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button {
                onToggle()
            } label: {
                Text("\(topic.emoji) \(topic.name)")
                    .font(.chipLabel)
                    .foregroundStyle(topic.enabled ? .white : Color.textSecondary)
            }

            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.bold())
                    .foregroundStyle(topic.enabled ? .white.opacity(0.7) : Color.textMuted)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(topic.enabled ? Color.accent : Color.bgCard)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(topic.enabled ? Color.accentLight : Color.borderDefault, lineWidth: 1)
        )
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = flowLayout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = flowLayout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func flowLayout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxX = max(maxX, x)
        }

        return (CGSize(width: maxX, height: y + rowHeight), positions)
    }
}
