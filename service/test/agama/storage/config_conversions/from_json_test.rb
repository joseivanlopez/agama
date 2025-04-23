# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require_relative "../../../test_helper"
require_relative "./from_json_examples"
require "agama/storage/configs"
require "agama/storage/config_conversions/from_json"
require "y2storage/encryption_method"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromJSON do
  subject do
    described_class.new(config_json, default_paths: default_paths, mandatory_paths: mandatory_paths)
  end

  let(:default_paths) { [] }

  let(:mandatory_paths) { [] }

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  describe "#convert" do
    let(:config_json) { {} }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    context "with an empty JSON" do
      let(:config_json) { {} }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(config.boot.device.default).to eq(true)
        expect(config.boot.device.device_alias).to be_nil
      end

      it "sets #drives to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
      end

      it "sets #volume_groups to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
        expect(config.volume_groups).to be_empty
      end
    end

    context "with a JSON specifying 'boot'" do
      let(:config_json) do
        {
          boot: {
            configure: true,
            device:    device
          }
        }
      end

      let(:device) { "sdb" }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(config.boot.device.default).to eq(false)
        expect(config.boot.device.device_alias).to eq("sdb")
      end

      context "if boot does not specify 'device'" do
        let(:device) { nil }

        it "sets #boot to the expected value" do
          config = subject.convert
          expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
          expect(config.boot.configure).to eq(true)
          expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
          expect(config.boot.device.default).to eq(true)
          expect(config.boot.device.device_alias).to be_nil
        end
      end
    end

    context "with a JSON specifying 'drives'" do
      let(:config_json) do
        { drives: drives }
      end

      let(:drives) do
        [
          drive,
          { alias: "second-disk" }
        ]
      end

      let(:drive) do
        { alias: "first-disk" }
      end

      context "with an empty list" do
        let(:drives) { [] }

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives).to eq([])
        end
      end

      context "with a list of drives" do
        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives.size).to eq(2)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))

          drive1, drive2 = config.drives
          expect(drive1.alias).to eq("first-disk")
          expect(drive1.partitions).to eq([])
          expect(drive2.alias).to eq("second-disk")
          expect(drive2.partitions).to eq([])
        end
      end

      drive_proc = proc { |c| c.drives.first }

      context "if a drive does not specify 'search'" do
        let(:drive) { {} }

        it "sets #search to the expected value" do
          drive = drive_proc.call(subject.convert)
          expect(drive.search).to be_a(Agama::Storage::Configs::Search)
          expect(drive.search.name).to be_nil
          expect(drive.search.if_not_found).to eq(:error)
        end
      end

      context "if a drive does not spicify 'alias'" do
        let(:drive) { {} }
        include_examples "without alias", drive_proc
      end

      context "if a drive does not spicify 'encryption'" do
        let(:drive) { {} }
        include_examples "without encryption", drive_proc
      end

      context "if a drive does not spicify 'filesystem'" do
        let(:drive) { {} }
        include_examples "without filesystem", drive_proc
      end

      context "if a drive does not spicify 'ptableType'" do
        let(:drive) { {} }
        include_examples "without ptableType", drive_proc
      end

      context "if a drive does not spicify 'partitions'" do
        let(:drive) { {} }
        include_examples "without partitions", drive_proc
      end

      context "if a drive specifies 'search'" do
        let(:drive) { { search: search } }
        include_examples "with search", drive_proc
      end

      context "if a drive specifies 'alias'" do
        let(:drive) { { alias: device_alias } }
        include_examples "with alias", drive_proc
      end

      context "if a drive specifies 'encryption'" do
        let(:drive) { { encryption: encryption } }
        include_examples "with encryption", drive_proc
      end

      context "if a drive specifies 'filesystem'" do
        let(:drive) { { filesystem: filesystem } }
        include_examples "with filesystem", drive_proc
      end

      context "if a drive specifies 'ptableType'" do
        let(:drive) { { ptableType: ptableType } }
        include_examples "with ptableType", drive_proc
      end

      context "if a drive specifies 'partitions'" do
        let(:drive) { { partitions: partitions } }
        include_examples "with partitions", drive_proc
      end
    end

    context "with a JSON specifying 'volumeGroups'" do
      let(:config_json) do
        { volumeGroups: volume_groups }
      end

      let(:volume_groups) do
        [
          volume_group,
          { name: "vg2" }
        ]
      end

      let(:volume_group) { { name: "vg1" } }

      context "with an empty list" do
        let(:volume_groups) { [] }

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups).to eq([])
        end
      end

      context "with a list of volume groups" do
        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups.size).to eq(2)
          expect(config.volume_groups).to all(be_a(Agama::Storage::Configs::VolumeGroup))

          volume_group1, volume_group2 = config.volume_groups
          expect(volume_group1.name).to eq("vg1")
          expect(volume_group1.logical_volumes).to eq([])
          expect(volume_group2.name).to eq("vg2")
          expect(volume_group2.logical_volumes).to eq([])
        end
      end

      vg_proc = proc { |c| c.volume_groups.first }

      context "if a volume group does not spicify 'name'" do
        let(:volume_group) { {} }

        it "does not set #name" do
          vg = vg_proc.call(subject.convert)
          expect(vg.name).to be_nil
        end
      end

      context "if a volume group does not spicify 'extentSize'" do
        let(:volume_group) { {} }

        it "does not set #extent_size" do
          vg = vg_proc.call(subject.convert)
          expect(vg.extent_size).to be_nil
        end
      end

      context "if a volume group does not spicify 'physicalVolumes'" do
        let(:volume_group) { {} }

        it "sets #physical_volumes to the expected vale" do
          vg = vg_proc.call(subject.convert)
          expect(vg.physical_volumes).to eq([])
        end
      end

      context "if a volume group does not spicify 'logicalVolumes'" do
        let(:volume_group) { {} }

        it "sets #logical_volumes to the expected vale" do
          vg = vg_proc.call(subject.convert)
          expect(vg.logical_volumes).to eq([])
        end
      end

      context "if a volume group spicifies 'name'" do
        let(:volume_group) { { name: "test" } }

        it "sets #name to the expected value" do
          vg = vg_proc.call(subject.convert)
          expect(vg.name).to eq("test")
        end
      end

      context "if a volume group spicifies 'extentSize'" do
        let(:volume_group) { { extentSize: size } }

        context "if 'extentSize' is a string" do
          let(:size) { "4 KiB" }

          it "sets #extent_size to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.extent_size).to eq(4.KiB)
          end
        end

        context "if 'extentSize' is a number" do
          let(:size) { 4096 }

          it "sets #extent_size to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.extent_size).to eq(4.KiB)
          end
        end
      end

      context "if a volume group spicifies 'physicalVolumes'" do
        let(:volume_group) { { physicalVolumes: physical_volumes } }

        context "with an empty list" do
          let(:physical_volumes) { [] }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to eq([])
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to eq([])
          end

          it "sets #physical_volumes_encryption to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list of aliases" do
          let(:physical_volumes) { ["pv1", "pv2"] }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to eq([])
          end

          it "sets #physical_volumes_encryption to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list including a physical volume with 'generate' array" do
          let(:physical_volumes) do
            [
              "pv1",
              { generate: ["disk1", "disk2"] },
              "pv2"
            ]
          end

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to contain_exactly("disk1", "disk2")
          end

          it "does not set #physical_volumes_encryption" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list including a physical volume with 'generate' section" do
          let(:physical_volumes) do
            [
              "pv1",
              {
                generate: {
                  targetDevices: target_devices,
                  encryption:    encryption
                }
              },
              "pv2"
            ]
          end

          let(:target_devices) { nil }

          let(:encryption) { nil }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          context "if the physical volume does not specify 'targetDevices'" do
            let(:target_devices) { nil }

            it "sets #physical_volumes_devices to the expected value" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_devices).to eq([])
            end
          end

          context "if the physical volume does not specify 'encryption'" do
            let(:target_devices) { nil }

            it "does not set #physical_volumes_encryption" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_encryption).to be_nil
            end
          end

          context "if the physical volume specifies 'targetDevices'" do
            let(:target_devices) { ["disk1"] }

            it "sets #physical_volumes_devices to the expected value" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_devices).to contain_exactly("disk1")
            end
          end

          context "if the physical volume specifies 'encryption'" do
            let(:encryption) do
              {
                luks1: { password: "12345" }
              }
            end

            it "sets #physical_volumes_encryption to the expected value" do
              vg = vg_proc.call(subject.convert)
              encryption = vg.physical_volumes_encryption
              expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
              expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
              expect(encryption.password).to eq("12345")
              expect(encryption.pbkd_function).to be_nil
              expect(encryption.label).to be_nil
              expect(encryption.cipher).to be_nil
              expect(encryption.key_size).to be_nil
            end
          end
        end
      end

      context "if a volume group spicifies 'logicalVolumes'" do
        let(:volume_group) { { logicalVolumes: logical_volumes } }

        let(:logical_volumes) do
          [
            logical_volume,
            { name: "test" }
          ]
        end

        let(:logical_volume) { { name: "root" } }

        context "with an empty list" do
          let(:logical_volumes) { [] }

          it "sets #logical_volumes to empty" do
            vg = vg_proc.call(subject.convert)
            expect(vg.logical_volumes).to eq([])
          end
        end

        context "with a list of logical volumes" do
          it "sets #logical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            lvs = vg.logical_volumes
            expect(lvs.size).to eq(2)

            lv1, lv2 = lvs
            expect(lv1).to be_a(Agama::Storage::Configs::LogicalVolume)
            expect(lv1.name).to eq("root")
            expect(lv2).to be_a(Agama::Storage::Configs::LogicalVolume)
            expect(lv2.name).to eq("test")
          end
        end

        lv_proc = proc { |c| c.volume_groups.first.logical_volumes.first }

        context "if a logical volume does not specify 'name'" do
          let(:logical_volume) { {} }

          it "does not set #name" do
            lv = lv_proc.call(subject.convert)
            expect(lv.name).to be_nil
          end
        end

        context "if a logical volume does not specify 'stripes'" do
          let(:logical_volume) { {} }

          it "does not set #stripes" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripes).to be_nil
          end
        end

        context "if a logical volume does not specify 'stripeSize'" do
          let(:logical_volume) { {} }

          it "does not set #stripe_size" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripe_size).to be_nil
          end
        end

        context "if a logical volume does not specify 'pool'" do
          let(:logical_volume) { {} }

          it "sets #pool? to false" do
            lv = lv_proc.call(subject.convert)
            expect(lv.pool?).to eq(false)
          end
        end

        context "if a logical volume does not specify 'usedPool'" do
          let(:logical_volume) { {} }

          it "does not set #used_pool" do
            lv = lv_proc.call(subject.convert)
            expect(lv.used_pool).to be_nil
          end
        end

        context "if a logical volume does not specify 'alias'" do
          let(:logical_volume) { {} }
          include_examples "without alias", lv_proc
        end

        context "if a logical volume does not specify 'size'" do
          let(:logical_volume) { {} }
          include_examples "without size", lv_proc
        end

        context "if a logical volume does not specify 'encryption'" do
          let(:logical_volume) { {} }
          include_examples "without encryption", lv_proc
        end

        context "if a logical volume does not specify 'filesystem'" do
          let(:logical_volume) { {} }
          include_examples "without filesystem", lv_proc
        end

        context "if a logical volume specifies 'stripes'" do
          let(:logical_volume) { { stripes: 10 } }

          it "sets #stripes to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripes).to eq(10)
          end
        end

        context "if a logical volume specifies 'stripeSize'" do
          let(:logical_volume) { { stripeSize: size } }

          context "if 'stripeSize' is a string" do
            let(:size) { "4 KiB" }

            it "sets #stripe_size to the expected value" do
              lv = lv_proc.call(subject.convert)
              expect(lv.stripe_size).to eq(4.KiB)
            end
          end

          context "if 'stripeSize' is a number" do
            let(:size) { 4096 }

            it "sets #stripe_size to the expected value" do
              lv = lv_proc.call(subject.convert)
              expect(lv.stripe_size).to eq(4.KiB)
            end
          end
        end

        context "if a logical volume specifies 'pool'" do
          let(:logical_volume) { { pool: true } }

          it "sets #pool? to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.pool?).to eq(true)
          end
        end

        context "if a logical volume specifies 'usedPool'" do
          let(:logical_volume) { { usedPool: "pool" } }

          it "sets #used_pool to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.used_pool).to eq("pool")
          end
        end

        context "if a logical volume specifies 'alias'" do
          let(:logical_volume) { { alias: device_alias } }
          include_examples "with alias", lv_proc
        end

        context "if a logical volume specifies 'size'" do
          let(:logical_volume) { { size: size } }
          include_examples "with size", lv_proc
        end

        context "if a logical volume specifies 'encryption'" do
          let(:logical_volume) { { encryption: encryption } }
          include_examples "with encryption", lv_proc
        end

        context "if a logical volume specifies 'filesystem'" do
          let(:logical_volume) { { filesystem: filesystem } }
          include_examples "with filesystem", lv_proc
        end
      end
    end

    shared_examples "with generate" do |configs_proc|
      context "with 'default' value" do
        let(:generate) { "default" }

        let(:default_paths) { ["/default1", "/default2"] }

        it "adds volumes for the default paths" do
          configs = configs_proc.call(subject.convert)

          default1 = configs.find { |c| c.filesystem.path == "/default1" }
          expect(default1).to_not be_nil
          expect(default1.encryption).to be_nil

          default2 = configs.find { |c| c.filesystem.path == "/default2" }
          expect(default2).to_not be_nil
          expect(default2.encryption).to be_nil
        end
      end

      context "with 'mandatory' value" do
        let(:generate) { "mandatory" }

        let(:mandatory_paths) { ["/mandatory1"] }

        it "adds volumes for the mandatory paths" do
          configs = configs_proc.call(subject.convert)

          mandatory1 = configs.find { |c| c.filesystem.path == "/mandatory1" }
          expect(mandatory1).to_not be_nil
          expect(mandatory1.encryption).to be_nil
        end
      end
    end

    context "generating partitions" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if a partition specifies 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: generate }
              ]
            }
          ]
        end

        partitions_proc = proc { |c| c.drives.first.partitions }
        include_examples "with generate", partitions_proc

        context "with a generate section" do
          let(:generate) do
            {
              partitions: "default",
              encryption: {
                luks2: { password: "12345" }
              }
            }
          end

          let(:default_paths) { ["/", "swap"] }

          it "adds the expected partitions" do
            partitions = partitions_proc.call(subject.convert)
            expect(partitions.size).to eq(2)

            root_part = partitions.find { |p| p.filesystem.path == "/" }
            swap_part = partitions.find { |p| p.filesystem.path == "swap" }

            expect(root_part).to_not be_nil
            expect(root_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(root_part.encryption.password).to eq("12345")

            expect(swap_part).to_not be_nil
            expect(swap_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(swap_part.encryption.password).to eq("12345")
          end
        end
      end

      context "if the device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(3)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          home_part = partitions.find { |p| p.filesystem.path == "/home" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
          expect(home_part).to_not be_nil
        end
      end

      context "if other device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" }
              ]
            },
            {
              partitions: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if a volume group already specifies any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(1)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          expect(root_part).to_not be_nil
        end
      end

      context "if the device specifies several partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions for the first 'generate'" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if several devices specify partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            },
            {
              partitions: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions to the first device with a 'generate'" do
          config = subject.convert
          drive1, drive2 = config.drives
          expect(drive1.partitions.size).to eq(2)
          expect(drive2.partitions.size).to eq(0)
        end
      end
    end

    context "generating logical volumes" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if a logical volume specifies 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: generate }
              ]
            }
          ]
        end

        logical_volumes_proc = proc { |c| c.volume_groups.first.logical_volumes }
        include_examples "with generate", logical_volumes_proc

        context "with a generate section" do
          let(:generate) do
            {
              logicalVolumes: "default",
              encryption:     {
                luks2: { password: "12345" }
              },
              stripes:        8,
              stripeSize:     "16 KiB"
            }
          end

          let(:default_paths) { ["/", "swap"] }

          it "adds the expected logical volumes" do
            lvs = logical_volumes_proc.call(subject.convert)
            expect(lvs.size).to eq(2)

            root_lv = lvs.find { |v| v.filesystem.path == "/" }
            swap_lv = lvs.find { |v| v.filesystem.path == "swap" }

            expect(root_lv).to_not be_nil
            expect(root_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(root_lv.encryption.password).to eq("12345")

            expect(swap_lv).to_not be_nil
            expect(swap_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(swap_lv.encryption.password).to eq("12345")
          end
        end
      end

      context "if the volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(3)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          home_lv = lvs.find { |v| v.filesystem.path == "/home" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
          expect(home_lv).to_not be_nil
        end
      end

      context "if other volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            },
            {
              logicalVolumes: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if a device already specifies a partition for any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(1)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          expect(root_lv).to_not be_nil
        end
      end

      context "if the volume group specifies several logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the first 'generate'" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if several volume groups specify logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            },
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes to the first volume group with a 'generate'" do
          config = subject.convert
          vg1, vg2 = config.volume_groups
          expect(vg1.logical_volumes.size).to eq(2)
          expect(vg2.logical_volumes.size).to eq(0)
        end
      end

      context "if a drive specifies a partition with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "does not add logical volumes to the volume group" do
          config = subject.convert
          vg = config.volume_groups.first
          expect(vg.logical_volumes.size).to eq(0)
        end
      end
    end
  end
end
