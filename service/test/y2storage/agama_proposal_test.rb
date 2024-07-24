# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  before do
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  subject(:proposal) do
    described_class.new(initial_settings, issues_list: issues_list)
  end
  let(:initial_settings) do
    Agama::Storage::Config.new.tap do |settings|
      settings.drives = [root_drive]
    end
  end
  let(:root_drive) do
    Agama::Storage::Configs::Drive.new.tap do |drive|
      drive.partitions = [
        Agama::Storage::Configs::Partition.new.tap do |part|
          part.mount = Agama::Storage::Configs::Mount.new.tap { |m| m.path = "/" }
          part.size = Agama::Storage::Configs::SizeRange.new.tap do |size|
            size.min = Y2Storage::DiskSize.GiB(8.5)
            size.max = Y2Storage::DiskSize.unlimited
          end
        end
      ]
    end
  end
  let(:issues_list) { [] }

  describe "#propose" do
    it "does something" do
      proposal.propose
      expect(proposal.devices.partitions.size).to eq 2
    end
  end
end
