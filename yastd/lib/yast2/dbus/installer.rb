# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

require "dbus"

module Yast2
  module DBus
    # YaST D-Bus object (/org/opensuse/YaST/Installer)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Installer < ::DBus::Object
      attr_reader :installer, :logger

      PROPERTY_INTERFACE = "org.freedesktop.DBus.Properties"
      INSTALLER_INTERFACE = "org.opensuse.YaST.Installer"

      # @param installer [Yast2::Installer] YaST installer instance
      # @param args [Array<Object>] ::DBus::Object arguments
      def initialize(installer, logger, *args)
        @installer = installer
        @logger = logger

        installer.on_status_change do |status|
          self.StatusChanged(status.id)
        end

        installer.dbus_obj = self

        super(*args)
      end

      dbus_interface INSTALLER_INTERFACE do
        dbus_method :GetLanguages, "out langs:a{sas}" do
          logger.info "GetLanguages"

          [installer.languages]
        end

        dbus_method :GetProducts, "out products:aa{ss}" do
          logger.info "GetProducts"

          products = installer.products.map do |product|
            { "name" => product.name, "display_name" => product.display_name }
          end
          [products]
        end

        dbus_method :GetStorage, "out proposal:aa{ss}" do
          logger.info "GetStorage"

          proposal = installer.storage_proposal.filesystems.map do |fs|
            blk_device = fs.blk_devices.first
            {
              "mount"  => fs.mount_point&.path,
              "device" => blk_device.name,
              "type"   => fs.type&.to_s,
              "size"   => blk_device.size.to_i.to_s
            }
          end
          [proposal]
        end

        dbus_method :GetDisks, "out disks:aa{ss}" do
          logger.info "GetDisks"

          disks = installer.disks.map do |disk|
            {
              "name"  => disk.name,
              "model" => disk.model,
              "size"  => disk.size.to_human_string
            }
          end

          [disks]
        end

        dbus_method :Probe, "out result:b" do
          logger.info "Probe"
          Thread.new { installer.probe }
          true
        end

        dbus_method :Start, "out result:b" do
          logger.info "Start"
          Thread.new { installer.install }
          true
        end

        # FIXME: should we merge progress and status?
        # TODO: return the id and the name
        dbus_method :GetStatus, "out status:n" do
          installer.status.id
        end

        dbus_signal :StatusChanged, "status:n"

        # signal for installation progress
        #
        # parameters:
        #
        # - message: localized string describing current step
        # - total_steps: how many steps will be done
        # - current_step: current step. Always in range of 0..total_steps
        # - total_substeps: total count of smaller steps done as part of big step. Can be 0, which means no substeps defined
        # - current_substep: current substep. Always in range of 0..total_substeps
        dbus_signal :Progress,
          "message:s, total_steps:t, current_step:t, total_substeps:t, current_substep:t"
      end

      dbus_interface PROPERTY_INTERFACE do
        dbus_method :Get, "in interface:s, in propname:s, out value:v" do |interface, propname|
          logger.info "Get(#{interface}, #{propname})"

          if interface != INSTALLER_INTERFACE
            raise ::DBus.error("org.freedesktop.DBus.Error.UnknownInterface"),
              "Interface '#{interface}' not found on object '{@path}'"
          end

          begin
            value = installer.send(propname.downcase.to_s)
            value.respond_to?(:id) ? value.id : value.to_s
          rescue NoMethodError
            raise ::DBus.error("org.freedesktop.DBus.Error.InvalidArgs"),
              "Property '#{interface}.#{propname}' not found on object '#{@path}'"
          end
        end

        dbus_method :Set,
          "in interface:s, in propname:s, in value:v" do |interface, propname, value|
          logger.info "Set(#{interface}, #{propname}, #{value})"

          unless interface == INSTALLER_INTERFACE
            raise ::DBus.error("org.freedesktop.DBus.Error.UnknownInterface"),
              "Interface '#{interface}' not found on object '#{@path}'"
          end

          begin
            s_value = value.to_s
            installer.send("#{propname.downcase}=", s_value)
            self.PropertiesChanged(interface, { propname => s_value }, [])
          rescue Yast2::Installer::InvalidValue
            raise ::DBus.error("org.freedesktop.DBus.Error.InvalidArgs"),
              "Value '#{value}' not valid for '#{interface}.#{propname}' on object '#{@path}'"
          rescue NoMethodError
            raise ::DBus.error("org.freedesktop.DBus.Error.InvalidArgs"),
              "Property '#{interface}.#{propname}' not found on object '#{@path}'"
          end
        end

        dbus_method :GetAll, "in interface:s, out value:a{sv}" do |interface|
          logger.info "GetAll(#{interface})"

          unless interface == INSTALLER_INTERFACE
            raise ::DBus.error("org.freedesktop.DBus.Error.UnknownInterface"),
              "Interface '#{interface}' not found on object '#{@path}'"
          end

          props = installer.options.merge("status" => installer.status.id)
          normalized_props = props.reduce({}) { |h, (k, v)| h.merge(k.capitalize => v) }
          [normalized_props]
        end

        dbus_signal :PropertiesChanged,
          "interface:s, changed_properties:a{sv}, invalidated_properties:as"
      end
    end
  end
end
