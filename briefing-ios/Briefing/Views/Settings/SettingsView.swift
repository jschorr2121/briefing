import SwiftUI

struct SettingsView: View {
    @Bindable var vm: HomeViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Length
                    VStack(alignment: .leading, spacing: 8) {
                        KickerText("Briefing length")

                        Picker("Length", selection: $vm.settings.briefingLength) {
                            ForEach(BriefingLength.allCases) { length in
                                Text(length.displayName).tag(length)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Tone
                    VStack(alignment: .leading, spacing: 8) {
                        KickerText("Tone")

                        Picker("Tone", selection: $vm.settings.tone) {
                            ForEach(BriefingTone.allCases) { tone in
                                Text(tone.displayName).tag(tone)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Include links
                    Toggle(isOn: $vm.settings.includeLinks) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Include Source Links")
                                .font(.bodyRegular)
                                .foregroundStyle(Color.textPrimary)
                            Text("Show article URLs in briefings")
                                .font(.bodySmall)
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                    .tint(Color.textPrimary)

                    // Voice
                    VoicePickerView(selectedVoice: $vm.settings.voice)
                }
                .padding()
            }
            .background(Color.bgPrimary)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        vm.persistSettings()
                        vm.showSettings = false
                    }
                    .foregroundStyle(Color.textPrimary)
                }
            }
        }
    }
}
