import SwiftUI

struct StoryCardView: View {
    let story: StoryCard

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Headline
            Text(story.headline)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)

            // Bullets
            VStack(alignment: .leading, spacing: 6) {
                ForEach(story.bullets.prefix(4), id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 6) {
                        Circle()
                            .fill(Color.accent)
                            .frame(width: 4, height: 4)
                            .padding(.top, 6)

                        Text(bullet)
                            .font(.bodySmall)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(2)
                    }
                }
            }

            Spacer()

            // Source & date footer
            HStack {
                if let source = story.source {
                    if let url = story.url, let link = URL(string: url) {
                        Link(source, destination: link)
                            .font(.caption)
                            .foregroundStyle(Color.info)
                    } else {
                        Text(source)
                            .font(.caption)
                            .foregroundStyle(Color.textMuted)
                    }
                }

                Spacer()

                if let date = story.date {
                    Text(date)
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                }
            }
        }
        .padding(14)
        .background(Color.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.borderDefault.opacity(0.5), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}
