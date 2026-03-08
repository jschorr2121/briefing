import SwiftUI

struct StoryCardView: View {
    let story: StoryCard
    let index: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: source + date
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

            // Headline
            Text(story.headline)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)

            // Bullets
            VStack(alignment: .leading, spacing: 8) {
                ForEach(story.bullets.prefix(4), id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(Color.accent.opacity(0.4))
                            .frame(width: 5, height: 5)
                            .padding(.top, 6)

                        Text(bullet)
                            .font(.bodySmall)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(3)
                    }
                }
            }

            Spacer(minLength: 0)

            // Read more link
            if let url = story.url, let link = URL(string: url) {
                Link(destination: link) {
                    HStack(spacing: 4) {
                        Text("Read more")
                            .font(.caption)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .foregroundStyle(Color.info)
                }
            }
        }
        .padding(16)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.03), radius: 4, y: 1)
        .padding(.horizontal)
    }
}
