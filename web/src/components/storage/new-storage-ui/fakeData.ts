/*
 * Copyright (c) [2024-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import { Disk } from "./types";

export const FAKE_DISKS: Disk[] = [
  {
    name: "/dev/sda",
    size: "500 GB",
    description: "Samsung SSD 860 EVO",
    partitions: [
      {
        name: "/dev/sda1",
        size: "512 MB",
        filesystem: "vfat",
      },
      {
        name: "/dev/sda2",
        size: "100 GB",
        filesystem: "ext4",
      },
      {
        name: "/dev/sda3",
        size: "399.5 GB",
        filesystem: "xfs",
      },
    ],
  },
  {
    name: "/dev/sdb",
    size: "1 TB",
    description: "WDC WD10EZEX-08WN4A0",
    partitions: [
      {
        name: "/dev/sdb1",
        size: "1 TB",
        mountPoint: "/backup",
        filesystem: "ext4",
      },
    ],
  },
  {
    name: "/dev/nvme0n1",
    size: "256 GB",
    description: "INTEL SSDPEKKW256G7",
    partitions: [],
  },
];
