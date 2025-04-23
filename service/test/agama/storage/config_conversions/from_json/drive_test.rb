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

require_relative "../../../../test_helper"
require_relative "../from_json_examples"
require "agama/storage/configs/drive"
require "agama/storage/configs/search"
require "agama/storage/config_conversions/from_json_conversions/drive"
require "y2storage/encryption_method"

describe Agama::Storage::ConfigConversions::FromJSONConversions::Drive do
  subject do
    described_class.new(drive_json)
  end

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  describe "#convert" do
    let(:drive_json) do
      {
        search: search,
        alias: device_alias,
        encryption: encryption,
        filesystem: filesystem,
        ptableType: ptable_type,
        partitions: partitions
      }
    end

    let(:search) { nil }
    let(:device_alias) { nil }
    let(:encryption) { nil }
    let(:filesystem) { nil }
    let(:ptable_type) { nil }
    let(:partitions) { nil }

    it "returns a drive config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::Drive)
    end

    drive_proc = proc { |c| c }

    context "if 'search' is not specified" do
      it "sets #search to the expected value" do
        drive = subject.convert
        expect(drive.search).to be_a(Agama::Storage::Configs::Search)
        expect(drive.search.name).to be_nil
        expect(drive.search.if_not_found).to eq(:error)
      end
    end

    include_examples "without alias", drive_proc
    include_examples "without encryption", drive_proc
    include_examples "without filesystem", drive_proc
    include_examples "without ptableType", drive_proc
    include_examples "without partitions", drive_proc
    include_examples "with search", drive_proc
    include_examples "with alias", drive_proc
    include_examples "with encryption", drive_proc
    include_examples "with filesystem", drive_proc
    include_examples "with ptableType", drive_proc
    include_examples "with partitions", drive_proc
  end
end
