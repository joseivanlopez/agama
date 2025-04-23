# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/with_encryption"
require "agama/storage/config_conversions/from_json_conversions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/with_partitions"
require "agama/storage/config_conversions/from_json_conversions/with_ptable_type"
require "agama/storage/configs/md_raid"
require "y2storage/disk_size"
require "y2storage/md_level"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # MD RAID conversion from JSON hash according to schema.
        class MdRaid < Base
        private

          include WithEncryption
          include WithFilesystem
          include WithPtableType
          include WithPartitions

          alias_method :md_raid_json, :config_json

          MD_LEVELS = [:raid0, :raid1, :raid5, :raid6, :raid10].freeze

          # @see Base
          # @return [Configs::MdRaid]
          def default_config
            Configs::MdRaid.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              name:        md_raid_json[:name],
              level:       convert_level,
              chunk_size:  convert_chunk_size,
              devices:     md_raid_json[:devices],
              encryption:  convert_encryption,
              filesystem:  convert_filesystem,
              ptable_type: convert_ptable_type,
              partitions:  convert_partitions
            }
          end

          # @return [Y2Storage::MdLevel, nil]
          def convert_level
            value = md_raid_json[:level]
            return unless value && MD_LEVELS.include(value.to_sym)

            Y2Storage::MdLevel.find(value.to_sym)
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_chunk_size
            value = md_raid_json[:chunkSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end
        end
      end
    end
  end
end
