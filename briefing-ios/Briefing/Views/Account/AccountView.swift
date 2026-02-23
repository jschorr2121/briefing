import SwiftUI

struct AccountView: View {
    @State private var vm = AccountViewModel()
    @State private var authManager = AuthManager.shared
    @State private var showSignOutConfirm = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Profile card
                VStack(spacing: 12) {
                    // Avatar
                    ZStack {
                        Circle()
                            .fill(Color.accent.opacity(0.2))
                            .frame(width: 72, height: 72)

                        Text(initials)
                            .font(.sectionTitle)
                            .foregroundStyle(Color.accent)
                    }

                    VStack(spacing: 4) {
                        if let name = authManager.user?.name {
                            Text(name)
                                .font(.cardTitle)
                                .foregroundStyle(Color.textPrimary)
                        }

                        Text(authManager.user?.email ?? "")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textSecondary)
                    }

                    TierBadgeView(tier: vm.tier)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderDefault, lineWidth: 1)
                )
                .padding(.horizontal)

                // Usage card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Daily Usage")
                            .font(.cardTitle)
                            .foregroundStyle(Color.textPrimary)
                        Spacer()
                        Text(vm.usageDisplay)
                            .font(.bodySmall)
                            .foregroundStyle(Color.textSecondary)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.bgSecondary)
                                .frame(height: 8)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(vm.usagePercentage > 0.8 ? Color.warning : Color.accent)
                                .frame(width: geo.size.width * min(vm.usagePercentage, 1.0), height: 8)
                        }
                    }
                    .frame(height: 8)
                }
                .padding()
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderDefault, lineWidth: 1)
                )
                .padding(.horizontal)

                // Subscription card
                VStack(alignment: .leading, spacing: 12) {
                    Text("Subscription")
                        .font(.cardTitle)
                        .foregroundStyle(Color.textPrimary)

                    if vm.isPro {
                        HStack {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundStyle(Color.accent)
                            Text("Briefing Pro")
                                .font(.bodyRegular)
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            if let status = vm.subscriptionStatus {
                                Text(status.capitalized)
                                    .font(.bodySmall)
                                    .foregroundStyle(Color.success)
                            }
                        }

                        if let end = vm.currentPeriodEnd {
                            Text("Renews \(end)")
                                .font(.bodySmall)
                                .foregroundStyle(Color.textMuted)
                        }
                    } else {
                        Text("Free plan — \(AppConfig.freeDailyLimit) briefings per day")
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textSecondary)

                        NavigationLink(destination: PricingView()) {
                            Text("Upgrade to Pro")
                                .font(.buttonLabel)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
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
                .padding(.horizontal)

                // Sign out
                Button {
                    showSignOutConfirm = true
                } label: {
                    Text("Sign Out")
                        .font(.buttonLabel)
                        .foregroundStyle(Color.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.danger.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
            .padding(.vertical)
        }
        .background(Color.bgPrimary)
        .navigationTitle("Account")
        .confirmationDialog("Sign Out", isPresented: $showSignOutConfirm) {
            Button("Sign Out", role: .destructive) {
                Task { await authManager.signOut() }
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
        .task {
            await vm.loadSubscription()
        }
    }

    private var initials: String {
        guard let name = authManager.user?.name else { return "?" }
        let parts = name.components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? ""
        let last = parts.count > 1 ? parts.last?.prefix(1) ?? "" : ""
        return "\(first)\(last)".uppercased()
    }
}
