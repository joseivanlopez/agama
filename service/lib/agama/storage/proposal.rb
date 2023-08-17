# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "y2storage"
require "agama/issue"
require "agama/storage/actions"
require "agama/storage/proposal_settings_conversion"

module Agama
  module Storage
    # Backend class to calculate a storage proposal.
    class Proposal
      # @param config [Config] Agama config
      # @param logger [Logger]
      def initialize(config, logger: nil)
        @config = config
        @logger = logger || Logger.new($stdout)
        @on_calculate_callbacks = []
      end

      # Whether the proposal was successfully calculated.
      #
      # @note: The proposal must not be invalidated.
      #
      # @return [Boolean]
      def success?
        calculated? && !proposal.failed?
      end

      # Whether the proposal was already calculated.
      #
      # @note: The proposal must not be invalidated.
      #
      # @return [Boolean]
      def calculated?
        !invalidated? && !proposal.nil?
      end

      # Whether the proposal was invalidated.
      #
      # @return [Boolean]
      def invalidated?
        !!@invalidated
      end

      # Invalidates the current proposal.
      def invalidate
        @invalidated = true
      end

      # Stores callbacks to be call after calculating a proposal.
      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Available devices for installation.
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer.candidate_disks
      end

      # Calculates a new proposal.
      #
      # @param settings [ProposalSettings] settings to calculate the proposal.
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate(settings)
        calculate_proposal(settings)

        @on_calculate_callbacks.each(&:call)
        @invalidated = false

        success?
      end

      # Settings used for calculating the proposal.
      #
      # @return [ProposalSettings, nil]
      def settings
        return nil unless calculated?

        ProposalSettingsConversion.from_y2storage(proposal.settings, config: config)
      end

      # Storage actions.
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        return [] unless proposal&.devices

        Actions.new(logger, proposal.devices.actiongraph).all
      end

      # List of issues.
      #
      # @return [Array<Issue>]
      def issues
        return [] unless calculated?

        [
          boot_device_issue,
          missing_devices_issue,
          proposal_issue
        ].compact
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # @return [Y2Storage::MinGuidedProposal, nil]
      def proposal
        return nil if invalidated?

        storage_manager.proposal
      end

      # Instantiates and executes a Y2Storage proposal with the given settings
      #
      # @param settings [Y2Storage::ProposalSettings]
      # @return [Y2Storage::GuidedProposal]
      def calculate_proposal(settings)
        proposal = Y2Storage::MinGuidedProposal.new(
          settings:      ProposalSettingsConversion.to_y2storage(settings, config: config),
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
        )
        proposal.propose
        storage_manager.proposal = proposal
      end

      # @return [Y2Storage::DiskAnalyzer]
      def disk_analyzer
        storage_manager.probed_disk_analyzer
      end

      # Devicegraph representing the system
      #
      # @return [Y2Storage::Devicegraph]
      def probed_devicegraph
        storage_manager.probed
      end

      def storage_manager
        Y2Storage::StorageManager.instance
      end

      # Returns an issue if there is no boot device.
      #
      # @return [Issue, nil]
      def boot_device_issue
        return if settings.boot_device

        Issue.new("No device selected for installation",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Returns an issue if any of the boot device is not found
      #
      # @return [Issue, nil]
      def missing_devices_issue
        return if available_devices.map(&:name).include?(settings.boot_device)

        Issue.new("Selected device is not found in the system",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Returns an issue if the proposal is not valid.
      #
      # @return [Issue, nil]
      def proposal_issue
        return if success?

        Issue.new("Cannot accommodate the required file systems for installation",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end
    end
  end
end
