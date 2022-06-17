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

require_relative "../../../test_helper"
require "dinstaller/dbus/clients/software"
require "dbus"

describe DInstaller::DBus::Clients::Software do
  before do
    allow(::DBus::SystemBus).to receive(:instance).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller.Software").and_return(service)
    allow(service).to receive(:object).with("/org/opensuse/DInstaller/Software1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Software1")
      .and_return(software_iface)
  end

  let(:bus) { instance_double(::DBus::SystemBus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:software_iface) { instance_double(::DBus::ProxyObjectInterface) }

  subject { described_class.new }

  describe "#available_products" do
    before do
      allow(software_iface).to receive(:[]).with("AvailableBaseProducts").and_return(
        [
          ["Tumbleweed", "openSUSE Tumbleweed", {}],
          ["Leap15.3", "openSUSE Leap 15.3", {}]
        ]
      )
    end

    it "returns the name and display name for all available products" do
      expect(subject.available_products).to contain_exactly(
        ["Tumbleweed", "openSUSE Tumbleweed"],
        ["Leap15.3", "openSUSE Leap 15.3"]
      )
    end
  end

  describe "#selected_product" do
    before do
      allow(software_iface).to receive(:[]).with("SelectedBaseProduct").and_return("Tumbleweed")
    end

    it "returns the name of the selected product" do
      expect(subject.selected_product).to eq("Tumbleweed")
    end
  end

  describe "#select_product" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "selects the given product" do
      expect(dbus_object).to receive(:SelectProduct).with("Tumbleweed")

      subject.select_product("Tumbleweed")
    end
  end

  describe "#Probe" do
    let(:dbus_object) { double(::DBus::ProxyObject, Probe: nil) }
    it "calls the D-Bus Probe method" do
      expect(dbus_object).to receive(:Probe)

      subject.probe
    end

    context "when a block is given" do
      it "passes the block to the Probe method (async)" do
        callback = proc {}
        expect(dbus_object).to receive(:Probe) do |&block|
          expect(block).to be(callback)
        end

        subject.probe(&callback)
      end
    end
  end
end