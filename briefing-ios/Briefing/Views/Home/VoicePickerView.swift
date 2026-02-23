import SwiftUI

struct VoicePickerView: View {
    @Binding var selectedVoice: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Voice")
                .font(.bodySmall)
                .foregroundStyle(Color.textMuted)

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
                                    ? .white
                                    : Color.textSecondary
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedVoice == voice.rawValue
                                    ? Color.accent
                                    : Color.bgSecondary
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(
                                        selectedVoice == voice.rawValue
                                            ? Color.accentLight
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
