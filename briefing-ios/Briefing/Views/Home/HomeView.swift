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

                // Free tier usage hint
                if vm.tier == "free", vm.usageUsed > 0 {
                    usageHint
                }

                // Topic selector
                TopicSelectorView(vm: vm)
                    .fadeIn(delay: 0.1)

                // Primary actions row
                primaryActions
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
                    briefingHeader
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
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                HStack(spacing: 8) {
                    Text("Briefing")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize()

                    TierBadgeView(tier: vm.tier)
                }
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
            Text("Your Daily News Brief")
                .font(.heroTitle)
                .foregroundStyle(Color.textPrimary)

            Text("Select topics, generate a personalized briefing, stay informed.")
                .font(.bodyRegular)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal)
    }

    private var usageHint: some View {
        HStack(spacing: 4) {
            Text("\(vm.usageUsed)/\(vm.usageLimit ?? 3) free briefings used today")
                .font(.caption)
                .foregroundStyle(Color.textMuted)
        }
    }

    private var primaryActions: some View {
        VStack(spacing: 12) {
            // Generate button
            GenerateButtonView(vm: vm)

            // Schedule + Settings row
            HStack(spacing: 12) {
                NavigationLink {
                    ScheduleView()
                } label: {
                    Label("Schedule", systemImage: "calendar")
                        .font(.chipLabel)
                }
                .buttonStyle(SecondaryActionStyle())

                Button {
                    vm.showSettings = true
                } label: {
                    Label("Settings", systemImage: "gearshape")
                        .font(.chipLabel)
                }
                .buttonStyle(SecondaryActionStyle())
            }
            .padding(.horizontal)
        }
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
                Label("Export", systemImage: "square.and.arrow.down")
                    .font(.chipLabel)
            }
            .buttonStyle(SecondaryActionStyle())

            #if DEBUG
            // Dev: full markdown with Perigon search params
            ShareLink(item: vm.exportFullMarkdown()) {
                Label("Download MD", systemImage: "arrow.down.doc")
                    .font(.chipLabel)
            }
            .buttonStyle(DevActionStyle())
            #endif
        }
        .padding(.horizontal)
    }

    private var briefingHeader: some View {
        HStack(spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "newspaper")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.accent)
                Text("Your News Briefing")
                    .font(.cardTitle)
                    .foregroundStyle(Color.textPrimary)
            }

            Spacer()

            // Stats
            HStack(spacing: 12) {
                Label("\(vm.briefings.count) topics", systemImage: "text.justify.left")
                Label(
                    "\(vm.briefings.flatMap(\.storyList).count) stories",
                    systemImage: "doc.text"
                )
            }
            .font(.caption)
            .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "newspaper")
                .font(.system(size: 40))
                .foregroundStyle(Color.textMuted)
                .frame(width: 80, height: 80)
                .background(Color.bgCard)
                .clipShape(Circle())

            Text("Ready to get informed?")
                .font(.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Text("Select your topics above and tap \"Generate Briefing\" to get your personalized news summary.")
                .font(.bodyRegular)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
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
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.borderDefault, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}

struct DevActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.warning)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.warning.opacity(0.3), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}
