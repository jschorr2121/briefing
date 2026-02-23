import SwiftUI

struct ScheduleFormView: View {
    @Bindable var vm: ScheduleViewModel

    private var isEditing: Bool { vm.editingSchedule != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textMuted)

                        TextField("your@email.com", text: $vm.formEmail)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textPrimary)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.borderDefault, lineWidth: 1)
                            )
                    }

                    // Topics
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Topics")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textMuted)

                        HStack(spacing: 8) {
                            TextField("Add topic", text: $vm.formTopicInput)
                                .font(.bodyRegular)
                                .foregroundStyle(Color.textPrimary)
                                .padding()
                                .background(Color.bgCard)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.borderDefault, lineWidth: 1)
                                )
                                .submitLabel(.done)
                                .onSubmit { vm.addFormTopic() }

                            Button {
                                vm.addFormTopic()
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(Color.accent)
                            }
                        }

                        FlowLayout(spacing: 6) {
                            ForEach(vm.formTopics, id: \.self) { topic in
                                HStack(spacing: 4) {
                                    Text(topic)
                                        .font(.chipLabel)

                                    Button {
                                        vm.removeFormTopic(topic)
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.caption2.bold())
                                    }
                                }
                                .foregroundStyle(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.accent)
                                .clipShape(Capsule())
                            }
                        }
                    }

                    // Frequency
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Frequency")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textMuted)

                        Picker("Frequency", selection: $vm.formFrequency) {
                            ForEach(ScheduleFrequency.allCases) { freq in
                                Text(freq.displayName).tag(freq)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Time
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Time")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textMuted)

                        TextField("08:00", text: $vm.formTime)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textPrimary)
                            .padding()
                            .background(Color.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.borderDefault, lineWidth: 1)
                            )
                    }

                    // Timezone
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Timezone")
                            .font(.bodySmall)
                            .foregroundStyle(Color.textMuted)

                        Text(vm.formTimezone)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textSecondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.borderDefault, lineWidth: 1)
                            )
                    }
                }
                .padding()
            }
            .background(Color.bgPrimary)
            .navigationTitle(isEditing ? "Edit Schedule" : "New Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        vm.showForm = false
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await vm.saveSchedule() }
                    }
                    .foregroundStyle(Color.accent)
                    .disabled(vm.formEmail.isEmpty || vm.formTopics.isEmpty)
                }
            }
        }
    }
}
