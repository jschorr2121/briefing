import SwiftUI
import SwiftData

struct GenerateButtonView: View {
    @Bindable var vm: HomeViewModel
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        Button {
            Task {
                await vm.generate()
                vm.saveToHistory(context: modelContext)
            }
        } label: {
            HStack(spacing: 10) {
                if vm.isGenerating {
                    LoadingDots()
                    Text("Generating...")
                } else {
                    Image(systemName: "bolt.fill")
                    Text("Generate Briefing")
                }
            }
            .font(.buttonLabel)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                vm.canGenerate
                    ? Color.accent
                    : Color.accent.opacity(0.4)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!vm.canGenerate)
        .padding(.horizontal)
    }
}
