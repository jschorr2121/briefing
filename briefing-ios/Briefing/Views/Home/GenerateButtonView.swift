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
                    Text("Preparing your edition...")
                } else {
                    Text("Generate Briefing")
                }
            }
            .font(.buttonLabel)
            .foregroundStyle(Color.bgPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                vm.canGenerate
                    ? Color.textPrimary
                    : Color.textPrimary.opacity(0.35)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .disabled(!vm.canGenerate)
        .padding(.horizontal)
    }
}
