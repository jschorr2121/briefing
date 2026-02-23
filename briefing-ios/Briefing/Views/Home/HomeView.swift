import SwiftUI
import SwiftData

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("Briefing", systemImage: "newspaper.fill")
            }

            NavigationStack {
                ScheduleView()
            }
            .tabItem {
                Label("Schedule", systemImage: "clock.fill")
            }

            NavigationStack {
                AccountView()
            }
            .tabItem {
                Label("Account", systemImage: "person.crop.circle.fill")
            }
        }
        .tint(Color.accent)
    }
}

struct HomeView: View {
    @State private var vm = HomeViewModel()
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero
                heroSection
                    .fadeIn()

                // Topic selector
                TopicSelectorView(vm: vm)
                    .fadeIn(delay: 0.1)

                // Generate button
                GenerateButtonView(vm: vm)
                    .fadeIn(delay: 0.2)

                // Secondary actions
                if !vm.briefings.isEmpty {
                    secondaryActions
                        .fadeIn(delay: 0.1)
                }

                // Error banner
                if let error = vm.generateError {
                    ErrorBannerView(
                        message: error,
                        onRetry: { Task { await vm.generate() } },
                        onDismiss: { vm.generateError = nil }
                    )
                    .padding(.horizontal)
                }

                // Audio player
                if vm.audioData != nil {
                    AudioPlayerView()
                        .padding(.horizontal)
                        .slideIn(from: .bottom)
                }

                // Briefing content
                if vm.isGenerating {
                    LoadingSkeletonView()
                } else if !vm.briefings.isEmpty {
                    briefingStats
                        .fadeIn()

                    ForEach(Array(vm.briefings.enumerated()), id: \.element.id) { index, briefing in
                        BriefingCardView(briefing: briefing)
                            .padding(.horizontal)
                            .slideIn(from: .bottom, delay: Double(index) * 0.1)
                    }
                } else {
                    emptyState
                        .fadeIn(delay: 0.3)
                }
            }
            .padding(.vertical)
        }
        .background(Color.bgPrimary)
        .navigationTitle("")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Text("Briefing")
                    .font(.sectionTitle)
                    .foregroundStyle(Color.textPrimary)
            }
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button {
                        vm.showHistory = true
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundStyle(Color.textSecondary)
                    }

                    Button {
                        vm.showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(Color.textSecondary)
                    }
                }
            }
        }
        .sheet(isPresented: $vm.showSettings) {
            SettingsView(vm: vm)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $vm.showHistory) {
            HistoryListView(vm: vm)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $vm.showEmailSheet) {
            EmailSheetView(vm: vm)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $vm.showUpgradePrompt) {
            NavigationStack {
                PricingView()
            }
            .presentationDetents([.large])
        }
        .task {
            await vm.loadSubscription()
        }
    }

    // MARK: - Subviews

    private var heroSection: some View {
        VStack(spacing: 8) {
            Text("Your Daily Briefing")
                .font(.heroTitle)
                .foregroundStyle(Color.textPrimary)

            Text("Select your topics and generate a personalized news briefing")
                .font(.bodyRegular)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal)
    }

    private var secondaryActions: some View {
        HStack(spacing: 12) {
            // Listen
            Button {
                Task { await vm.loadAudio() }
            } label: {
                Label(
                    vm.isLoadingAudio ? "Loading..." : "Listen",
                    systemImage: vm.isLoadingAudio ? "waveform" : "headphones"
                )
                .font(.chipLabel)
            }
            .buttonStyle(SecondaryActionStyle())
            .disabled(vm.isLoadingAudio)

            // Email
            Button {
                vm.emailAddress = AuthManager.shared.user?.email ?? ""
                vm.showEmailSheet = true
            } label: {
                Label("Email", systemImage: "envelope")
                    .font(.chipLabel)
            }
            .buttonStyle(SecondaryActionStyle())

            // Export
            ShareLink(item: vm.exportMarkdown()) {
                Label("Export", systemImage: "square.and.arrow.up")
                    .font(.chipLabel)
            }
            .buttonStyle(SecondaryActionStyle())
        }
        .padding(.horizontal)
    }

    private var briefingStats: some View {
        HStack(spacing: 16) {
            Label("\(vm.briefings.count) topics", systemImage: "text.justify.left")
            Label(
                "\(vm.briefings.flatMap(\.storyList).count) stories",
                systemImage: "doc.text"
            )
        }
        .font(.bodySmall)
        .foregroundStyle(Color.textMuted)
        .padding(.horizontal)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "newspaper")
                .font(.system(size: 48))
                .foregroundStyle(Color.textMuted)
            Text("Select topics above and tap Generate")
                .font(.bodyRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

// MARK: - Button Style

struct SecondaryActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.textSecondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.borderDefault, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}
