import SwiftUI
import SwiftData

struct HistoryListView: View {
    @Bindable var vm: HomeViewModel
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \BriefingHistoryEntry.generatedAt, order: .reverse)
    private var entries: [BriefingHistoryEntry]

    var body: some View {
        NavigationStack {
            List {
                if entries.isEmpty {
                    ContentUnavailableView(
                        "No History",
                        systemImage: "clock",
                        description: Text("Generated briefings will appear here")
                    )
                } else {
                    ForEach(entries, id: \.entryId) { entry in
                        Button {
                            vm.loadFromHistory(entry)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "newspaper")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.accent)
                                    .frame(width: 32, height: 32)
                                    .background(Color.accent.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))

                                VStack(alignment: .leading, spacing: 4) {
                                    // Topic names as title
                                    let topics = entry.topicNames.isEmpty
                                        ? entry.briefings.map(\.topic)
                                        : entry.topicNames

                                    Text(topics.isEmpty ? "Briefing" : topics.joined(separator: ", "))
                                        .font(.bodyRegular)
                                        .foregroundStyle(Color.textPrimary)
                                        .lineLimit(1)

                                    HStack(spacing: 8) {
                                        Text(formatDate(entry.generatedAt))
                                        Text("\u{2022}")
                                        Text("\(entry.briefings.count) topics")
                                    }
                                    .font(.caption)
                                    .foregroundStyle(Color.textMuted)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(Color.textMuted)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .onDelete { offsets in
                        for offset in offsets {
                            modelContext.delete(entries[offset])
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.bgPrimary)
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !entries.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Clear All") {
                            vm.clearHistory(context: modelContext)
                        }
                        .foregroundStyle(Color.danger)
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") {
                        vm.showHistory = false
                    }
                }
            }
        }
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: iso) else { return iso }
        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .short
        return display.string(from: date)
    }
}
