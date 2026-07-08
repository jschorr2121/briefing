import SwiftUI

struct VoicePickerView: View {
    @Binding var selectedVoice: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            KickerText("Voice")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(AppConfig.Voice.allCases) { voice in
                    Button {
                        selectedVoice = voice.rawValue
                        HapticManager.selection()
                    } label: {
                        Text(voice.displayName)
                            .font(.chipLabel)
                            .foregroundStyle(
                                selectedVoice == voice.rawValue
                                    ? Color.bgPrimary
                                    : Color.textSecondary
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedVoice == voice.rawValue
                                    ? Color.textPrimary
                                    : Color.bgCard
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(
                                        selectedVoice == voice.rawValue
                                            ? Color.textPrimary
                                            : Color.borderDefault,
                                        lineWidth: 1
                                    )
                            )
                    }
                }
            }
        }
    }
}
