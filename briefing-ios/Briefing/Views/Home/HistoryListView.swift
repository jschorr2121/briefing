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
                            VStack(alignment: .leading, spacing: 6) {
                                Text(entry.topicNames.joined(separator: ", "))
                                    .font(.bodyRegular)
                                    .foregroundStyle(Color.textPrimary)
                                    .lineLimit(1)

                                Text(formatDate(entry.generatedAt))
                                    .font(.bodySmall)
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
