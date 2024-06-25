# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require "agama/storage/volume_conversion/from_schema"
require "agama/storage/volume_conversion/from_y2storage"
require "agama/storage/volume_conversion/to_schema"
require "agama/storage/volume_conversion/to_y2storage"

module Agama
  module Storage
    # Conversions for a volume
    module VolumeConversion
      # Performs conversion from Y2Storage.
      #
      # @param volume [Agama::Storage::Volume]
      # @return [Agama::Storage::Volume]
      def self.from_y2storage(volume)
        FromY2Storage.new(volume).convert
      end

      # Performs conversion to Y2Storage.
      #
      # @param volume [Agama::Storage::Volume]
      # @return [Y2Storage::VolumeSpecification]
      def self.to_y2storage(volume)
        ToY2Storage.new(volume).convert
      end

      # Performs conversion from Hash according to JSON schema.
      #
      # @param volume_schema [Hash]
      # @param config [Agama::Config]
      #
      # @return [Agama::Storage::Volume]
      def self.from_schema(volume_schema, config:)
        FromSchema.new(volume_schema, config: config).convert
      end

      # Performs conversion according to JSON schema.
      #
      # @param volume [Agama::Storage::Volume]
      # @return [Hash]
      def self.to_schema(volume)
        ToSchema.new(volume).convert
      end
    end
  end
end
