import SwiftUI

struct ScheduleView: View {
    @State private var vm = ScheduleViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Info banner
                HStack(spacing: 12) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(Color.info)
                    Text("Schedule automated briefings delivered to your email at the time you choose.")
                        .font(.bodySmall)
                        .foregroundStyle(Color.textSecondary)
                }
                .padding()
                .background(Color.info.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Create button
                Button {
                    vm.openCreateForm()
                } label: {
                    HStack {
                        Image(systemName: "plus")
                        Text("Create Schedule")
                    }
                    .font(.buttonLabel)
                    .foregroundStyle(Color.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(Color.accent.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [8]))
                    )
                }
                .padding(.horizontal)

                // Schedule cards
                if vm.isLoading {
                    ProgressView()
                        .tint(Color.accent)
                        .padding(.top, 32)
                } else if vm.schedules.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "clock")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.textMuted)
                        Text("No schedules yet")
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .padding(.top, 48)
                } else {
                    ForEach(vm.schedules) { schedule in
                        ScheduleCardView(
                            schedule: schedule,
                            onEdit: { vm.openEditForm(schedule) },
                            onDelete: { Task { await vm.deleteSchedule(schedule) } },
                            onToggle: { Task { await vm.toggleSchedule(schedule) } }
                        )
                        .padding(.horizontal)
                    }
                }

                if let error = vm.error {
                    ErrorBannerView(message: error, onDismiss: { vm.error = nil })
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Color.bgPrimary)
        .navigationTitle("Schedules")
        .sheet(isPresented: $vm.showForm) {
            ScheduleFormView(vm: vm)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .task {
            await vm.loadSchedules()
        }
    }
}

// MARK: - Schedule Card

struct ScheduleCardView: View {
    let schedule: Schedule
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(schedule.topics.joined(separator: ", "))
                        .font(.cardTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        Label(schedule.time, systemImage: "clock")
                        Label(schedule.frequency.rawValue.capitalized, systemImage: "calendar")
                    }
                    .font(.bodySmall)
                    .foregroundStyle(Color.textMuted)
                }

                Spacer()

                Toggle("", isOn: Binding(
                    get: { schedule.enabled },
                    set: { _ in onToggle() }
                ))
                .labelsHidden()
                .tint(Color.accent)
            }

            HStack(spacing: 8) {
                Text(schedule.email)
                    .font(.bodySmall)
                    .foregroundStyle(Color.textSecondary)

                Spacer()

                Button {
                    onEdit()
                } label: {
                    Image(systemName: "pencil")
                        .font(.bodySmall)
                        .foregroundStyle(Color.textMuted)
                }

                Button {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .font(.bodySmall)
                        .foregroundStyle(Color.danger)
                }
            }
        }
        .padding()
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.borderDefault, lineWidth: 1)
        )
        .opacity(schedule.enabled ? 1 : 0.6)
    }
}
