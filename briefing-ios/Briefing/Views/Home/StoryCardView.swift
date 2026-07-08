import SwiftUI

struct StoryCardView: View {
    let story: StoryCard
    let index: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Byline row: source + date
            HStack {
                if let source = story.source {
                    if let url = story.url, let link = URL(string: url) {
                        Link(destination: link) {
                            KickerText(source, color: .accent)
                        }
                    } else {
                        KickerText(source)
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
                .font(.headline)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(3)
                .lineSpacing(2)

            Rectangle()
                .fill(Color.borderDefault)
                .frame(height: 1)

            // Bullets
            VStack(alignment: .leading, spacing: 8) {
                ForEach(story.bullets.prefix(4), id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 8) {
                        Rectangle()
                            .fill(Color.textMuted)
                            .frame(width: 8, height: 1)
                            .padding(.top, 8)

                        Text(bullet)
                            .font(.bodySmall)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(3)
                            .lineSpacing(3)
                    }
                }
            }

            Spacer(minLength: 0)

            // Read more link
            if let url = story.url, let link = URL(string: url) {
                Link(destination: link) {
                    HStack(spacing: 4) {
                        Text("Read the full story")
                            .font(.caption.weight(.semibold))
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .foregroundStyle(Color.accent)
                }
            }
        }
        .padding(16)
        .background(Color.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal)
    }
}
