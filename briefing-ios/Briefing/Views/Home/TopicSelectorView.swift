import SwiftUI

struct TopicSelectorView: View {
    @Bindable var vm: HomeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Input row
            HStack(spacing: 8) {
                TextField(
                    vm.atTopicLimit ? "Maximum \(vm.topicLimit) topics reached" : "Add any topics you'd like in your briefing...",
                    text: $vm.newTopicName
                )
                    .font(.bodyRegular)
                    .foregroundStyle(Color.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.borderDefault, lineWidth: 1)
                    )
                    .submitLabel(.done)
                    .onSubmit { vm.addTopic() }
                    .disabled(vm.atTopicLimit)
                    .opacity(vm.atTopicLimit ? 0.5 : 1)

                Button {
                    vm.addTopic()
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(Color.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(vm.newTopicName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.atTopicLimit)
                .opacity(vm.newTopicName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.atTopicLimit ? 0.3 : 1)
            }

            // Topic count
            if vm.topicLimit > 0 {
                Text("\(vm.topics.count)/\(vm.topicLimit) topics")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            }

            // Selected topics
            if !vm.topics.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(vm.topics) { topic in
                        TopicChipView(
                            topic: topic,
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
                VStack(alignment: .leading, spacing: 8) {
                    Text("Suggestions:")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)

                    FlowLayout(spacing: 8) {
                        ForEach(remainingSuggestions) { topic in
                            Button {
                                vm.addSuggestedTopic(topic)
                            } label: {
                                HStack(spacing: 4) {
                                    Text("+")
                                        .font(.bodySmall)
                                    Text(topic.name)
                                        .font(.bodySmall)
                                }
                                .foregroundStyle(Color.textSecondary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.bgCard)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.borderDefault, lineWidth: 1)
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
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(topic.name)
                .font(.chipLabel)
                .foregroundStyle(.white)

            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.accent)
        .clipShape(Capsule())
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
