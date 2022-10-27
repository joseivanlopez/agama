# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "y2storage/storage_manager"
require "y2storage/guided_proposal"
require "y2storage/dialogs/guided_setup/helpers/disk"
require "dinstaller/with_progress"
require "dinstaller/storage/volume"
require "dinstaller/storage/proposal_settings"

module DInstaller
  module Storage
    # Backend class to calculate a storage proposal
    class Proposal
      include WithProgress

      # Constructor
      #
      # @param logger [Logger]
      # @param config [Config]
      def initialize(logger, config)
        @logger = logger
        @config = config
        @on_calculate_callbacks = []
      end

      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Available devices for installation
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer.candidate_disks
      end

      # Volume definitions to be used as templates in the interface
      #
      # Based on the configuration and/or on Y2Storage internals, these volumes may really
      # exist or not in the real context of the proposal and its settings.
      #
      # @return [Array<Volumes>]
      def volume_templates
        volumes_from_config
      end

      # Label that should be used to represent the given disk in the UI
      #
      # NOTE: this is likely a temporary solution. The label should not be calculated in the backend
      # in the future. See the note about available_devices at {DBus::Storage::Proposal}.
      #
      # The label has the form: "NAME, SIZE, [USB], INSTALLED_SYSTEMS".
      #
      # Examples:
      #
      #   "/dev/sda, 250.00 GiB, Windows, OpenSUSE"
      #   "/dev/sdb, 8.00 GiB, USB"
      #
      # @param device [Y2Storage::Device]
      # @return [String]
      def device_label(device)
        disk_helper.label(device)
      end

      # Settings that were used to calculate the proposal
      #
      # @return [ProposalSettings, nil]
      def settings
        return nil unless proposal

        @settings
      end

      # Volumes used during the calculation of the proposal
      #
      # Not to be confused with settings.volumes, which are used as starting point
      #
      # @return [Array<Volumes>]
      def volumes
        return [] unless proposal

        volumes = volumes_from_proposal(only_proposed: true)
        volumes.each do |volume|
          config_spec = config_spec_for(volume)
          volume.optional = config_spec ? config_spec.proposed_configurable? : true
        end

        volumes
      end

      # Calculates a new proposal
      #
      # @param settings [ProposalSettings] settings to calculate the proposal
      # @return [Boolean] whether the proposal was correctly calculated
      def calculate(settings = nil)
        @settings = settings || default_settings
        @settings.freeze
        proposal_settings = calculate_y2storage_settings

        @proposal = new_proposal(proposal_settings)
        storage_manager.proposal = proposal

        @on_calculate_callbacks.each(&:call)

        !proposal.failed?
      end

      # Storage actions manager
      #
      # @fixme this method should directly return the actions
      #
      # @return [Storage::Actions]
      def actions
        # FIXME: this class could receive the storage manager instance
        @actions ||= Actions.new(logger)
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # @return [Y2Storage::InitialGuidedProposal]
      attr_reader :proposal

      def new_proposal(proposal_settings)
        guided = Y2Storage::MinGuidedProposal.new(
          settings:      proposal_settings,
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
        )
        guided.propose
        guided
      end

      def default_settings
        ProposalSetings.new.tap do |settings|
          settings.volumes = volumes_from_config(only_proposed: true)
        end
      end

      def volumes_from_config(only_proposed: false)
        all_specs = specs_from_config
        specs = only_proposed ? all_specs.select(&:proposed?) : all_specs

        specs.map do |spec|
          Volume.new(s).tap { |v| v.assing_size_relevant_volumes(all_specs) }
        end
      end

      def specs_from_config
        config_volumes = config.data.fetch("storage", {}).fetch("volumes", [])
        config_volumes.map { |v| Y2Storage::VolumeSpecification.new(v) }
      end

      def config_spec_for(volume)
        specs_from_config.find { |s| volume.mounted_at?(s.mount_point) }
      end

      def volumes_from_proposal(only_proposed: false)
        all_specs = specs_from_proposal
        specs = only_proposed ? all_specs.select(&:proposed?) : all_specs

        specs.map do |spec|
          Volume.new(spec).tap do |volume|
            volume.assign_size_relevant_volumes(all_specs)
            volume.encrypted = proposal.settings.use_encryption
            planned = planned_device_for(volume)
            if planned
              volume.device_type = planned.respond_to?(:lv_type) ? :logical_volume : :partition
              volume.min_size = planned.min
              volume.max_size = planned.max
            end
          end
        end
      end

      def specs_from_proposal
        return [] unless proposal

        proposal.settings.volumes
      end

      def planned_device_for(volume)
        return nil unless proposal

        proposal.planned_devices.find do |device|
          device.respond_to?(:mount_point) && volume.mounted_at?(device.mount_point)
        end
      end

      def calculate_y2storage_settings
        return nil unless settings

        Y2Storage::ProposalSettings.new_for_current_product.tap do |proposal_settings|
          proposal_settings.use_lvm = settings.use_lvm?
          proposal_settings.encryption_password = settings.encryption_password
          proposal_settings.candidate_devices = settings.candidate_devices
          proposal_settings.volumes = settings.volumes.map(&:spec)
        end
      end

      # @return [Y2Storage::DiskAnalyzer]
      def disk_analyzer
        storage_manager.probed_disk_analyzer
      end

      # Helper to generate a disk label
      #
      # @return [Y2Storage::Dialogs::GuidedSetup::Helpers::Disk]
      def disk_helper
        @disk_helper ||= Y2Storage::Dialogs::GuidedSetup::Helpers::Disk.new(disk_analyzer)
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
    end
  end
end
