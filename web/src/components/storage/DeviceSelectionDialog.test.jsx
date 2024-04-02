/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DeviceSelectionDialog } from "~/components/storage";

const sda = {
  sid: "59",
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  busId: "",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  size: 1024,
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const sdb = {
  sid: "62",
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

const sdc = {
  sid: "63",
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdc",
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

let props;

const expectSelector = (selector) => {
  const option = (name) => {
    const row = within(selector).getByRole("row", { name });
    return within(row).queryByRole("radio") || within(row).queryByRole("checkbox");
  };

  const matchers = (modifier = (obj) => obj) => {
    return {
      toHaveCheckedOption: (name) => {
        modifier(expect(option(name))).toBeChecked();
      },
      toBeVisible: () => {
        // Jsdom does not report correct styles, see https://github.com/jsdom/jsdom/issues/2986.
        // expect(selector).not.toBeVisible();
        modifier(expect(selector.parentNode)).toHaveAttribute("aria-expanded", "true");
      }
    };
  };

  return { ...matchers(), not: { ...matchers((obj) => obj.not) } };
};

describe("DeviceSelectionDialog", () => {
  beforeEach(() => {
    props = {
      isOpen: true,
      target: "disk",
      targetDevice: sda,
      targetPVDevices: [],
      devices: [sda, sdb, sdc],
      onCancel: jest.fn(),
      onAccept: jest.fn()
    }
  });

  it("offers an option to select a disk as target device for installation", () => {
    plainRender(<DeviceSelectionDialog {...props} />);
    screen.getByRole("radio", { name: "Select a disk" });
  });

  it("offers an option to create a new LVM volume group as target device for installation", () => {
    plainRender(<DeviceSelectionDialog {...props} />);
    screen.getByRole("radio", { name: "Create an LVM Volume Group" });
  });

  describe("if the target is a disk", () => {
    beforeEach(() => {
      props.target = "disk";
      props.targetDevice = sda;
    });

    it("selects the disk option by default", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).toBeChecked();
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();
    });

    it("shows the disk selector", async () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expect(diskSelector).toBeVisible();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(lvmSelector).not.toBeVisible();
    });

    it("shows the target disk as selected", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const selector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(selector).toHaveCheckedOption(/sda/);
      expectSelector(selector).not.toHaveCheckedOption(/sdb/);
      expectSelector(selector).not.toHaveCheckedOption(/sdc/);
    });

    it("allows to switch to new LVM", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();

      await user.click(lvmOption);

      expect(lvmOption).toBeChecked();
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expect(lvmSelector).toBeVisible();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(diskSelector).not.toBeVisible();
    });
  });

  describe("if the target is a new LVM volume group", () => {
    beforeEach(() => {
      props.target = "newLvmVg";
      props.targetPVDevices = [sda, sdc];
    });

    it("selects the LVM option by default", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).toBeChecked();
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();
    });

    it("shows the selector for LVM candidate devices", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expect(lvmSelector).toBeVisible();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(diskSelector).not.toBeVisible();
    });

    it("shows the current candidate devices as selected", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const selector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(selector).toHaveCheckedOption(/sda/);
      expectSelector(selector).not.toHaveCheckedOption(/sdb/);
      expectSelector(selector).toHaveCheckedOption(/sdc/);
    });

    it("allows to switch to disk", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();

      await user.click(diskOption);

      expect(diskOption).toBeChecked();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expect(diskSelector).toBeVisible();
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(lvmSelector).not.toBeVisible();
    });
  });

  describe.only("if the option to select a disk as target device is selected", () => {
    beforeEach(() => {
      props.target = "disk";
      props.targetDevice = sda;
    });

    it("submits the selected target and disk on accept", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

      await user.click(button);

      const selector = await screen.findByRole("dialog", { name: /Device for installing/ });
      const diskGrid = within(selector).getByRole("grid", { name: /target disk/ });
      const sdbRow = within(diskGrid).getByRole("row", { name: /sdb/ });
      const sdbOption = within(sdbRow).getByRole("radio");
      const accept = within(selector).getByRole("button", { name: "Confirm" });

      await user.click(sdbOption);
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).toHaveBeenCalledWith({
        target: "disk",
        targetDevice: sdb.name,
        targetPVDevices: []
      });
    });
  })

  //   it("allows canceling a device selection", async () => {
  //     const { user } = plainRender(<ProposalDeviceSection {...props} />);
  //     const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

  //     await user.click(button);

  //     const selector = await screen.findByRole("dialog", { name: /Device for installing/ });
  //     const diskGrid = within(selector).getByRole("grid", { name: /target disk/ });
  //     const sdbRow = within(diskGrid).getByRole("row", { name: /sdb/ });
  //     const sdbOption = within(sdbRow).getByRole("radio");
  //     const cancel = within(selector).getByRole("button", { name: "Cancel" });

  //     await user.click(sdbOption);
  //     await user.click(cancel);

  //     expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  //     expect(props.onChange).not.toHaveBeenCalled();
  //   });

});
