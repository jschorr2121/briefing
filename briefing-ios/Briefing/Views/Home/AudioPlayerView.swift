import SwiftUI

struct AudioPlayerView: View {
    @State private var player = AudioPlayerManager.shared

    private let speeds: [Float] = [0.75, 1.0, 1.25, 1.5, 2.0]

    var body: some View {
        VStack(spacing: 14) {
            // Progress slider
            VStack(spacing: 4) {
                Slider(
                    value: Binding(
                        get: { player.progress },
                        set: { player.seek(to: $0 * player.duration) }
                    ),
                    in: 0...1
                )
                .tint(Color.accent)

                HStack {
                    Text(formatTime(player.currentTime))
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                    Spacer()
                    Text(formatTime(player.duration))
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                }
            }

            // Controls
            HStack(spacing: 20) {
                // Skip back
                Button {
                    player.seekRelative(-15)
                } label: {
                    Image(systemName: "gobackward.15")
                        .font(.title3)
                        .foregroundStyle(Color.textSecondary)
                }

                // Play/Pause
                Button {
                    player.togglePlayPause()
                    HapticManager.impact(.light)
                } label: {
                    Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.accent)
                }

                // Skip forward
                Button {
                    player.seekRelative(15)
                } label: {
                    Image(systemName: "goforward.15")
                        .font(.title3)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            // Speed buttons
            HStack(spacing: 8) {
                ForEach(speeds, id: \.self) { speed in
                    Button {
                        player.playbackSpeed = speed
                        HapticManager.selection()
                    } label: {
                        Text(speed == 1.0 ? "1x" : "\(speed, specifier: "%.2g")x")
                            .font(.caption.bold())
                            .foregroundStyle(
                                player.playbackSpeed == speed
                                    ? .white
                                    : Color.textSecondary
                            )
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                player.playbackSpeed == speed
                                    ? Color.accent
                                    : Color.bgSecondary
                            )
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding()
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
